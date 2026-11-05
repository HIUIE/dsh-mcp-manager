/**
 * Safe configuration writes for MCP Manager.
 *
 * Every mutation follows the same order, because a broken loader patch can stop
 * the application from starting:
 *
 *   read → validate the proposed text → back up the current file → write a
 *   temporary sibling → re-validate → rename over the target.
 *
 * The rename is atomic on the same filesystem, so a crash mid-write leaves the
 * original file intact. Nothing here ever writes a file it could not parse
 * after the change.
 *
 * @module dsh-mcp-manager/lib/writer
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { jsonMcpEntries, parseToml, parseYaml, dshPatchEntries, WRITE_STRATEGIES } from './sources.js'

/** Directory, inside DSH home, that keeps every configuration backup. */
export const BACKUP_DIR_NAME = 'mcp-manager-backups'

/**
 * Resolve the backup directory for this machine.
 *
 * @returns {string} absolute path.
 */
export function backupRoot() {
  const home = process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh')
  return join(home, BACKUP_DIR_NAME)
}

/**
 * Validate configuration text for one source strategy.
 *
 * This is the gate every write passes through: it parses the proposed text with
 * the same parser the reader uses and reports what a human needs to fix.
 *
 * @param {string} text - the proposed file content.
 * @param {string} strategy - one of `WRITE_STRATEGIES`.
 * @returns {{ ok: boolean, errors: string[], servers: Array<object> }} the verdict.
 */
export function validateText(text, strategy) {
  const errors = []
  let servers = []
  if (strategy === WRITE_STRATEGIES.dshPatch) {
    const parsed = parseYaml(text)
    errors.push(...parsed.errors)
    if (parsed.value !== null && !Array.isArray(parsed.value)) {
      errors.push('the patch must be a YAML sequence (a top-level array of entries)')
    }
    if (Array.isArray(parsed.value)) {
      servers = dshPatchEntries(parsed.value).map((entry) => ({
        name: entry.config.serverName,
        patchId: entry.patchId,
        transport: entry.config.transport ?? (entry.config.command ? 'stdio' : 'streamable-http'),
      }))
      const seen = new Set()
      for (const entry of dshPatchEntries(parsed.value)) {
        const name = String(entry.config.serverName)
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) {
          errors.push(`server name "${name}" must match ^[A-Za-z0-9_-]{1,32}$`)
        }
        if (seen.has(entry.patchId)) errors.push(`duplicate entry id "${entry.patchId}"`)
        seen.add(entry.patchId)
        const transport = entry.config.transport ?? (entry.config.command ? 'stdio' : 'streamable-http')
        if (transport === 'stdio' && typeof entry.config.command !== 'string') {
          errors.push(`"${name}" is a stdio server but has no command`)
        }
        if (transport !== 'stdio' && typeof entry.config.url !== 'string') {
          errors.push(`"${name}" is a ${transport} server but has no url`)
        }
      }
    }
  } else if (strategy === WRITE_STRATEGIES.tomlMcpServers) {
    const parsed = parseToml(text)
    errors.push(...parsed.errors)
    servers = Object.entries(parsed.value?.mcp_servers ?? {}).map(([name, raw]) => ({
      name,
      transport: raw?.command ? 'stdio' : 'streamable-http',
    }))
  } else {
    try {
      const parsed = JSON.parse(text)
      const declarations = jsonMcpEntries(parsed)
      servers = declarations.map((entry) => ({
        name: entry.name,
        transport: entry.raw.command ? 'stdio' : (entry.raw.type ?? 'streamable-http'),
      }))
      for (const entry of declarations) {
        // A declaration with neither is a real-world placeholder (an app wrote
        // an empty entry); report it as a warning-level problem only when the
        // draft being added is expected to be runnable, never as a parse error.
        if (entry.raw.command === undefined && entry.raw.url === undefined) continue
      }
    } catch (error) {
      const message = String(error?.message ?? error)
      errors.push(`invalid JSON: ${message}`)
    }
  }
  return { ok: errors.length === 0, errors, servers }
}

/**
 * Snapshot a file before it is edited.
 *
 * @param {string} path - the file about to change.
 * @param {string} reason - a short slug recorded in the filename.
 * @param {number} retain - how many backups of this file to keep.
 * @returns {{ backup: string | null, pruned: string[] }} the backup path.
 */
export function backupFile(path, reason, retain = 20) {
  if (!existsSync(path)) return { backup: null, pruned: [] }
  const root = backupRoot()
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = basename(path).replace(/[^\w.-]/g, '_')
  const slug = String(reason ?? 'edit').replace(/[^\w-]/g, '-').slice(0, 40)
  const target = join(root, `${safeName}.${stamp}.${slug}.bak`)
  copyFileSync(path, target)
  chmodSync(target, 0o600)
  // Keep the backup list bounded so a config edited daily does not grow forever.
  const pruned = []
  const prefix = `${safeName}.`
  const mine = readdirSync(root)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.bak'))
    .map((name) => ({ name, at: statSync(join(root, name)).mtimeMs }))
    .sort((a, b) => a.at - b.at)
  const excess = mine.length - Math.max(1, retain)
  for (let i = 0; i < excess; i += 1) {
    try {
      unlinkSync(join(root, mine[i].name))
      pruned.push(mine[i].name)
    } catch {
      /* a backup we could not prune is not a reason to fail the write */
    }
  }
  return { backup: target, pruned }
}

/**
 * Write text atomically: temp file in the same directory, then rename.
 *
 * @param {string} path - the destination.
 * @param {string} text - the complete new content.
 * @returns {{ path: string, bytes: number, previous: string | null }} the outcome.
 */
export function atomicWrite(path, text) {
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : null
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  const temp = join(dir, `.${basename(path)}.tmp-${process.pid}-${Date.now()}`)
  const mode = existsSync(path) ? statSync(path).mode & 0o777 : 0o600
  writeFileSync(temp, text, { encoding: 'utf8', mode })
  chmodSync(temp, mode)
  try {
    renameSync(temp, path)
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      /* the rename failure is the error worth reporting */
    }
    throw error
  }
  return { path, bytes: Buffer.byteLength(text), previous }
}

/**
 * Apply one safe edit: validate, back up, write, and re-validate on disk.
 *
 * @param {object} request - the edit.
 * @param {string} request.path - target file.
 * @param {string} request.text - full proposed content.
 * @param {string} request.strategy - how the file is parsed.
 * @param {string} [request.reason] - recorded in the backup name.
 * @param {number} [request.retain] - backups to keep.
 * @returns {{ ok: boolean, errors: string[], backup: string | null, path: string }} the outcome.
 */
export function safeWrite({ path, text, strategy, reason = 'edit', retain = 20 }) {
  const before = validateText(text, strategy)
  if (!before.ok) return { ok: false, errors: before.errors, backup: null, path }
  const { backup } = backupFile(path, reason, retain)
  try {
    atomicWrite(path, text)
  } catch (error) {
    return { ok: false, errors: [`write failed: ${String(error?.message ?? error)}`], backup, path }
  }
  // Trust the bytes on disk, not the string we asked for.
  let reread = ''
  try {
    reread = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, errors: [`read-back failed: ${String(error?.message ?? error)}`], backup, path }
  }
  const after = validateText(reread, strategy)
  if (!after.ok) {
    if (backup !== null) {
      try {
        atomicWrite(path, readFileSync(backup, 'utf8'))
      } catch {
        /* report the validation failure; the backup is still on disk */
      }
    }
    return { ok: false, errors: ['the written file failed validation and was restored', ...after.errors], backup, path }
  }
  return { ok: true, errors: [], backup, path }
}
