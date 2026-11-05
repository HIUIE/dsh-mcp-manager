/**
 * Host half of the MCP Manager bundle.
 *
 * Responsibilities, and nothing else:
 *
 *  1. discover every MCP server declared in the configuration files of this
 *     machine, tagging DSH-profile entries with their loader patch id;
 *  2. keep "declared enabled" and "currently connected" apart — the first comes
 *     from the file, the second only from asking the running MCP client;
 *  3. expose the read and write operations as HTTP routes the dashboard calls.
 *
 * Every write goes through `lib/writer.js`, which backs the file up and refuses
 * to leave it unparseable.
 *
 * @module dsh-mcp-manager
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import {
  backupRoot,
  safeWrite,
  validateText,
} from './lib/writer.js'
import {
  WRITE_STRATEGIES,
  dshPatchEntries,
  jsonMcpEntries,
  entriesOf,
  maskUrl,
  normaliseServer,
  parseToml,
  parseYaml,
  sourceCatalogue,
  tomlMcpEntries,
} from './lib/sources.js'

/** Route prefix owned by this plugin. */
export const ROUTE_PREFIX = '/api/dsh-mcp-manager'

/** Plugin name recorded by the loader for the MCP client rows. */
const MCP_CLIENT_PLUGIN = '@deepseek-ai/dsh-mcp-client'

/**
 * @typedef {object} McpManagerConfig
 * @property {number} [scanTtlMs] - how long a configuration scan is reused.
 * @property {number} [toolsTtlMs] - how long a live tool listing is reused.
 * @property {number} [retainBackups] - backups kept per edited file.
 * @property {boolean} [includeOtherApps] - list servers from other applications.
 */

/**
 * Reject cross-origin callers: these routes read configuration paths and can
 * write files, so an arbitrary page must never reach them.
 *
 * @param {import('node:http').IncomingMessage} req - incoming request.
 * @param {string | undefined} origin - the server's own origin.
 * @returns {boolean} whether the request may proceed.
 */
function sameOrigin(req, origin) {
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return false
  const source = req.headers.origin
  if (!source) return true
  if (origin && source === origin) return true
  try {
    return new URL(source).host === req.headers.host
  } catch {
    return false
  }
}

/**
 * Write one JSON response.
 *
 * @param {import('node:http').ServerResponse} res - the response.
 * @param {number} status - HTTP status.
 * @param {unknown} body - payload.
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Read a request body as JSON with a size cap.
 *
 * @param {import('node:http').IncomingMessage} req - the request.
 * @param {number} [limit] - maximum accepted bytes.
 * @returns {Promise<unknown>} the parsed body.
 */
function readJsonBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error(`request body exceeds ${limit} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error(`invalid JSON body: ${String(error?.message ?? error)}`))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Host plugin entry point.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context.
 * @param {McpManagerConfig} config - this row's configuration.
 */
export function apply(ctx, config) {
  const resolved = {
    scanTtlMs: Number(config?.scanTtlMs ?? 15_000),
    toolsTtlMs: Number(config?.toolsTtlMs ?? 60_000),
    retainBackups: Number(config?.retainBackups ?? 20),
    includeOtherApps: config?.includeOtherApps !== false,
  }

  const sources = sourceCatalogue()
  const sourceById = new Map(sources.map((source) => [source.id, source]))

  /** Cache of the last configuration scan. */
  const scanCache = { value: null, at: 0 }
  /** Cache of live tool listings keyed by server name. */
  const toolsCache = new Map()

  /**
   * Parse one source file into normalised declarations.
   *
   * Returns declarations even when the file has problems, so the dashboard can
   * show a broken file rather than hiding it.
   *
   * @param {object} source - a catalogue entry.
   * @returns {{ declarations: Array<object>, errors: string[], text: string | null }} result.
   */
  function readSource(source) {
    if (!source.exists) return { declarations: [], errors: [], text: null }
    let text = ''
    try {
      text = readFileSync(source.path, 'utf8')
    } catch (error) {
      return { declarations: [], errors: [`cannot read: ${String(error?.message ?? error)}`], text: null }
    }
    if (source.strategy === WRITE_STRATEGIES.dshPatch) {
      const parsed = parseYaml(text)
      const entries = dshPatchEntries(parsed.value)
      return {
        text,
        errors: parsed.errors,
        declarations: entries.map((entry) => ({
          name: String(entry.config.serverName),
          raw: entry.config,
          patchId: entry.patchId,
          enabled: !entry.disabled,
          loaderRow: true,
        })),
      }
    }
    if (source.strategy === WRITE_STRATEGIES.tomlMcpServers) {
      const parsed = parseToml(text)
      return { text, errors: parsed.errors, declarations: tomlMcpEntries(parsed.value) }
    }
    try {
      const parsed = JSON.parse(text)
      return { text, errors: [], declarations: jsonMcpEntries(parsed) }
    } catch (error) {
      return { text, errors: [`invalid JSON: ${String(error?.message ?? error)}`], declarations: [] }
    }
  }

  /**
   * Whether a DSH row is live in the running Loader, and under which status.
   *
   * @param {string} patchId - the loader entry id.
   * @returns {{ mounted: boolean, state: string }} loader state.
   */
  function loaderState(patchId) {
    // The Loader is reachable through several shapes depending on how the app
    // is booted; probe them in order and report `unknown` rather than guessing.
    const loader = ctx.get('loader') ?? ctx.get('app')?.loader ?? ctx.root?.loader
    if (!loader) return { mounted: false, state: 'unknown' }
    let entries = []
    try {
      if (typeof loader.entries === 'function') entries = loader.entries()
      else if (Array.isArray(loader.entries)) entries = loader.entries
      else if (typeof loader.get === 'function') {
        const found = loader.get(patchId)
        entries = found ? [found] : []
      }
    } catch {
      return { mounted: false, state: 'unknown' }
    }
    const byId = (candidate) => candidate?.id ?? candidate?.options?.id ?? candidate?.options?.name
    const entry = entries.find((candidate) => byId(candidate) === patchId)
    if (!entry) return { mounted: false, state: 'unknown' }
    const options = entry.options ?? {}
    if (options.disabled === true) return { mounted: false, state: 'disabled' }
    // `fork`/`plugin` holds the live plugin instance once the row is applied.
    const live = entry.fork !== undefined || entry.plugin !== undefined || entry.active !== false
    return { mounted: Boolean(live), state: live ? 'mounted' : 'pending' }
  }

  /* ---------------------------------------------------------------------- */
  /* Live tool information                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Every tool the running host currently exposes, grouped by MCP server.
   *
   * Tools registered by `dsh-mcp-client` are named
   * `mcp__<serverName>__<toolName>`, so the registry itself is the authority on
   * what is connected right now.
   *
   * @returns {Record<string, { tools: Array<object>, connected: boolean }>} by server.
   */
  function liveMcpTools() {
    const grouped = {}
    const tools = ctx.get('tools')
    if (!tools || typeof tools.schemas !== 'function') return grouped
    let schemas = []
    try {
      schemas = tools.schemas()
    } catch {
      return grouped
    }
    for (const schema of schemas) {
      const name = String(schema?.name ?? '')
      const match = /^mcp__([^_].*?)__(.+)$/.exec(name)
      if (!match) continue
      const server = match[1]
      const toolName = match[2]
      const bucket = grouped[server] ?? { tools: [], connected: true }
      bucket.tools.push({
        name: toolName,
        wireName: name,
        description: String(schema?.description ?? ''),
        parameters: schema?.parameters ?? schema?.inputSchema ?? null,
      })
      grouped[server] = bucket
    }
    return grouped
  }

  /* ---------------------------------------------------------------------- */
  /* Scan                                                                    */
  /* ---------------------------------------------------------------------- */

  /**
   * Build the full inventory the dashboard renders.
   *
   * @param {boolean} [force] - ignore the scan cache.
   * @returns {object} the inventory payload.
   */
  function scan(force = false) {
    const now = Date.now()
    if (!force && scanCache.value !== null && now - scanCache.at < resolved.scanTtlMs) return scanCache.value

    const live = liveMcpTools()
    const servers = []
    const sourceReports = []

    for (const source of sources) {
      if (source.kind === 'other' && !resolved.includeOtherApps) continue
      const read = readSource(source)
      sourceReports.push({
        id: source.id,
        app: source.app,
        appId: source.appId,
        kind: source.kind,
        label: source.label,
        path: source.path,
        format: source.format,
        strategy: source.strategy,
        exists: source.exists,
        size: source.exists ? safeSize(source.path) : 0,
        mtime: source.exists ? safeMtime(source.path) : 0,
        serverCount: read.declarations.length,
        errors: read.errors,
        note: source.note,
      })
      for (const declaration of read.declarations) {
        const record = normaliseServer({
          name: declaration.name,
          raw: declaration.raw,
          source,
          patchId: declaration.patchId ?? null,
          enabled: declaration.enabled,
        })
        // The running host only runs the MCP rows in ITS OWN loader patch, so a
        // server registered under the same name in another application is not
        // "connected" here — only a host source can make that claim.
        const liveInfo = source.kind === 'host' ? live[declaration.name] : undefined
        record.reachable = Boolean(liveInfo)
        record.connected = Boolean(liveInfo)
        record.toolCount = liveInfo ? liveInfo.tools.length : 0
        record.liveElsewhere = Boolean(!liveInfo && live[declaration.name])
        record.mounted = false
        if (declaration.patchId) {
          const state = loaderState(declaration.patchId)
          record.mounted = state.mounted
          record.loaderState = state.state
        }
        record.capabilities = {
          // Changing the file is always possible; taking effect may need a reload.
          canToggle: true,
          canEdit: true,
          canDelete: true,
          canRestart: Boolean(declaration.patchId),
          restartMode: declaration.patchId ? 'reload-profile' : 'restart-app',
        }
        servers.push(record)
      }
    }

    servers.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'host' ? -1 : 1
      if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId)
      return a.name.localeCompare(b.name)
    })

    const totals = {
      servers: servers.length,
      enabled: servers.filter((item) => item.declared).length,
      disabled: servers.filter((item) => !item.declared).length,
      connected: servers.filter((item) => item.reachable).length,
      tools: servers.reduce((sum, item) => sum + item.toolCount, 0),
      sources: sourceReports.filter((item) => item.exists).length,
      brokenSources: sourceReports.filter((item) => item.errors.length > 0).length,
      hostServers: servers.filter((item) => item.kind === 'host').length,
      otherServers: servers.filter((item) => item.kind === 'other').length,
    }

    const value = {
      generatedAt: new Date().toISOString(),
      host: { app: 'DeepSeek Harness', profile: process.env.DSH_PROFILE ?? null, dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh') },
      totals,
      servers,
      sources: sourceReports,
      backupDir: backupRoot(),
      config: resolved,
    }
    scanCache.value = value
    scanCache.at = now
    return value
  }

  const safeSize = (path) => {
    try {
      return statSync(path).size
    } catch {
      return 0
    }
  }
  const safeMtime = (path) => {
    try {
      return statSync(path).mtimeMs
    } catch {
      return 0
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Mutation helpers                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Locate the file text and strategy for a server uid.
   *
   * @param {string} uid - `sourceId:serverName`.
   * @returns {{ source: object, name: string, text: string } | { error: string }} target.
   */
  function locate(uid) {
    const cut = String(uid).indexOf(':')
    if (cut <= 0) return { error: `malformed server id "${uid}"` }
    const sourceId = String(uid).slice(0, cut)
    const name = String(uid).slice(cut + 1)
    const source = sourceById.get(sourceId)
    if (!source) return { error: `unknown source "${sourceId}"` }
    if (!source.exists) return { error: `${source.app} has no configuration file yet; add a server first` }
    try {
      return { source, name, text: readFileSync(source.path, 'utf8') }
    } catch (error) {
      return { error: `cannot read ${source.path}: ${String(error?.message ?? error)}` }
    }
  }

  /**
   * Serialise a YAML scalar safely.
   *
   * @param {unknown} value - the value.
   * @returns {string} a YAML scalar.
   */
  const yamlScalar = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    const text = String(value)
    if (/^[A-Za-z0-9_./@^+=-]*$/.test(text) && text !== '' && !/^(true|false|null|yes|no|~)$/i.test(text)) return text
    return JSON.stringify(text)
  }

  /**
   * Render one MCP client entry as loader-patch YAML.
   *
   * @param {string} patchId - the entry id.
   * @param {object} server - normalised server fields.
   * @param {number} indexIndent - indentation of the `-` item.
   * @returns {string} YAML text.
   */
  function renderDshEntry(patchId, server, indexIndent) {
    const pad = ' '.repeat(indexIndent)
    const inner = ' '.repeat(indexIndent + 2)
    const deep = ' '.repeat(indexIndent + 4)
    const lines = []
    lines.push(`${pad}- id: ${yamlScalar(patchId)}`)
    lines.push(`${inner}name: ${yamlScalar(MCP_CLIENT_PLUGIN)}`)
    lines.push(`${inner}config:`)
    lines.push(`${deep}serverName: ${yamlScalar(server.name)}`)
    lines.push(`${deep}transport: ${yamlScalar(server.transport)}`)
    if (server.transport === 'stdio') {
      lines.push(`${deep}command: ${yamlScalar(server.command ?? '')}`)
      if (server.args && server.args.length > 0) {
        lines.push(`${deep}args:`)
        for (const arg of server.args) lines.push(`${' '.repeat(indexIndent + 6)}- ${yamlScalar(arg)}`)
      } else {
        lines.push(`${deep}args: []`)
      }
      const envNames = Object.keys(server.env ?? {})
      if (envNames.length > 0) {
        lines.push(`${deep}env:`)
        for (const key of envNames) lines.push(`${' '.repeat(indexIndent + 6)}${yamlScalar(key)}: ${yamlScalar(server.env[key])}`)
      }
      if (server.cwd) lines.push(`${deep}cwd: ${yamlScalar(server.cwd)}`)
    } else {
      lines.push(`${deep}url: ${yamlScalar(server.url ?? '')}`)
      const headerNames = Object.keys(server.headers ?? {})
      if (headerNames.length > 0) {
        lines.push(`${deep}headers:`)
        for (const key of headerNames) lines.push(`${' '.repeat(indexIndent + 6)}${yamlScalar(key)}: ${yamlScalar(server.headers[key])}`)
      }
    }
    if (server.reconnect && typeof server.reconnect === 'object') {
      const keys = Object.keys(server.reconnect).filter((key) => ['enabled', 'initialDelayMs', 'maxDelayMs', 'maxAttempts'].includes(key))
      if (keys.length > 0) {
        lines.push(`${deep}reconnect:`)
        for (const key of keys) lines.push(`${' '.repeat(indexIndent + 6)}${key}: ${yamlScalar(server.reconnect[key])}`)
      }
    }
    if (typeof server.toolCallTimeoutMs === 'number') {
      lines.push(`${deep}toolCallTimeoutMs: ${server.toolCallTimeoutMs}`)
    }
    return lines.join('\n')
  }

  /**
   * Splice a rendered entry into a patch document, creating `insert:` if needed.
   *
   * @param {string} text - current patch text.
   * @param {string} yamlEntry - rendered entry block.
   * @param {'append' | 'replace'} mode - whether to replace an existing id.
   * @param {string} [replaceId] - the id to replace.
   * @returns {string} the new patch text.
   */
  function spliceDshEntry(text, yamlEntry, mode, replaceId) {
    const lines = text.split('\n')
    const trimmed = text.trimEnd()
    if (mode === 'replace' && replaceId) {
      // Rewrite the block that owns `replaceId` in place.
      const startIndex = lines.findIndex((line) => new RegExp(`^\\s*-\\s+id:\\s*["']?${replaceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(line))
      if (startIndex !== -1) {
        const itemIndent = lines[startIndex].length - lines[startIndex].trimStart().length
        let end = lines.length
        for (let i = startIndex + 1; i < lines.length; i += 1) {
          const line = lines[i]
          if (!line.trim()) continue
          const indent = line.length - line.trimStart().length
          if (indent < itemIndent) {
            end = i
            break
          }
          if (indent === itemIndent && line.trimStart().startsWith('-')) {
            end = i
            break
          }
        }
        while (end > startIndex + 1 && !lines[end - 1].trim()) end -= 1
        const before = lines.slice(0, startIndex)
        const after = lines.slice(end)
        const block = yamlEntry.split('\n')
        return [...before, ...block, ...after].join('\n')
      }
    }
    // Append: reuse the last `insert:` list when the file already has one.
    const insertMatches = [...trimmed.matchAll(/^(\s*)insert:\s*$/gm)]
    if (insertMatches.length > 0) {
      const last = insertMatches[insertMatches.length - 1]
      const insertIndent = last[1].length
      // The item marker must sit one level below `insert:`; reuse the depth the
      // file already uses when it has items, so the addition matches the file.
      const insertPos = last.index + last[0].length
      const lines = trimmed.split('\n')
      const insertLine = trimmed.slice(0, last.index).split('\n').length - 1
      let itemIndent = insertIndent + 2
      for (let i = insertLine + 1; i < lines.length; i += 1) {
        const line = lines[i]
        if (!line.trim()) continue
        const indent = line.length - line.trimStart().length
        if (indent <= insertIndent) break
        if (line.trimStart().startsWith('- ')) itemIndent = indent
        break
      }
      // The list runs until a non-blank line indented at or below `insert:`.
      let end = lines.length
      for (let i = insertLine + 1; i < lines.length; i += 1) {
        const line = lines[i]
        if (!line.trim()) continue
        const indent = line.length - line.trimStart().length
        if (indent <= insertIndent) {
          end = i
          break
        }
      }
      while (end > insertLine + 1 && !lines[end - 1].trim()) end -= 1
      // Shift the whole rendered block by one delta so its internal structure
      // (the `- id:` line plus its nested `config:` keys) stays intact.
      const rendered = yamlEntry.split('\n')
      const renderedBase = rendered[0].length - rendered[0].trimStart().length
      const delta = itemIndent - renderedBase
      const entry = rendered.map((line) => (line.trim() ? ' '.repeat(Math.max(0, delta)) + line : line))
      const next = [...lines.slice(0, end), ...entry, ...lines.slice(end)]
      return next.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    }
    // No insert list yet: append one, shifting the entry under `insert:`.
    const rendered = yamlEntry.split('\n')
    const renderedBase = rendered[0].length - rendered[0].trimStart().length
    const delta = 4 - renderedBase
    const entry = rendered.map((line) => (line.trim() ? ' '.repeat(Math.max(0, delta)) + line : line))
    return `${trimmed}\n- insert:\n${entry.join('\n')}\n`
  }

  /**
   * True for a value the browser shows instead of a secret.
   *
   * @param {unknown} value - the incoming value.
   * @returns {boolean} whether it is a mask.
   */
  const isMasked = (value) => typeof value === 'string' && value.includes('\u2022')

  /**
   * Replace masked env/header values with the real ones already on disk.
   *
   * The browser never receives a secret, so a save that leaves a masked field
   * untouched must keep the stored value rather than write the mask back.
   *
   * @param {Record<string, string>} incoming - the submitted map.
   * @param {Record<string, string>} current - the on-disk map.
   * @returns {Record<string, string>} the map to write.
   */
  function unmaskMap(incoming, current) {
    const out = {}
    const base = current && typeof current === 'object' ? current : {}
    for (const [key, value] of Object.entries(incoming ?? {})) {
      out[key] = isMasked(value) && typeof base[key] === 'string' ? base[key] : String(value)
    }
    return out
  }

  /**
   * Mask a raw declaration before it leaves the Host.
   *
   * @param {object} declaration - the on-disk declaration.
   * @returns {object} a copy safe to send to the browser.
   */
  function maskDeclaration(declaration) {
    const masked = { ...declaration }
    if (masked.env && typeof masked.env === 'object') {
      masked.env = Object.fromEntries(entriesOf(masked.env))
    }
    if (masked.headers && typeof masked.headers === 'object') {
      masked.headers = Object.fromEntries(entriesOf(masked.headers))
    }
    if (typeof masked.url === 'string') masked.url = maskUrl(masked.url).value
    return masked
  }

  /**
   * Produce the next file text for one operation.
   *
   * @param {object} request - the operation.
   * @returns {{ ok: boolean, text?: string, error?: string }} the result.
   */
  function nextText(request) {
    const target = locate(request.uid)
    if ('error' in target) return { ok: false, error: target.error }
    const { source, name, text } = target
    const strategy = source.strategy
    const op = request.op

    if (strategy === WRITE_STRATEGIES.dshPatch) {
      const parsed = parseYaml(text)
      if (parsed.errors.length > 0) return { ok: false, error: `the file does not parse (${parsed.errors[0]}); fix it before editing` }
      const entries = dshPatchEntries(parsed.value)
      const entry = entries.find((item) => String(item.config.serverName) === name)
      if (!entry) return { ok: false, error: `"${name}" is not in ${source.label}` }
      if (op === 'toggle') {
        const lines = text.split('\n')
        const idPattern = new RegExp(`^(\\s*)disabled:\\s*(true|false)\\s*$`)
        // Insert or flip `disabled:` inside the block that owns this id.
        const startIndex = lines.findIndex((line) => new RegExp(`^\\s*-\\s+id:\\s*["']?${entry.patchId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(line))
        if (startIndex === -1) return { ok: false, error: 'could not locate the entry block' }
        const itemIndent = lines[startIndex].length - lines[startIndex].trimStart().length
        let end = lines.length
        let disabledAt = -1
        let insertAt = startIndex + 1
        for (let i = startIndex + 1; i < lines.length; i += 1) {
          const line = lines[i]
          if (!line.trim()) continue
          const indent = line.length - line.trimStart().length
          if (indent <= itemIndent) {
            end = i
            break
          }
          insertAt = i + 1
          if (idPattern.test(line) && indent === itemIndent + 2) disabledAt = i
        }
        const wantDisabled = request.enabled === false
        if (disabledAt !== -1) {
          if (wantDisabled) lines[disabledAt] = `${' '.repeat(itemIndent + 2)}disabled: true`
          else lines.splice(disabledAt, 1)
        } else if (wantDisabled) {
          lines.splice(startIndex + 1, 0, `${' '.repeat(itemIndent + 2)}disabled: true`)
        }
        void end
        void insertAt
        return { ok: true, text: lines.join('\n') }
      }
      if (op === 'delete') {
        const lines = text.split('\n')
        const startIndex = lines.findIndex((line) => new RegExp(`^\\s*-\\s+id:\\s*["']?${entry.patchId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(line))
        if (startIndex === -1) return { ok: false, error: 'could not locate the entry block' }
        const itemIndent = lines[startIndex].length - lines[startIndex].trimStart().length
        let end = lines.length
        for (let i = startIndex + 1; i < lines.length; i += 1) {
          const line = lines[i]
          if (!line.trim()) continue
          const indent = line.length - line.trimStart().length
          if (indent <= itemIndent) {
            end = i
            break
          }
        }
        const next = [...lines.slice(0, startIndex), ...lines.slice(end)]
        return { ok: true, text: next.join('\n') }
      }
      if (op === 'update') {
        const merged = { ...entry.config, ...(request.server ?? {}) }
        if (merged.env) merged.env = unmaskMap(merged.env, entry.config.env)
        if (merged.headers) merged.headers = unmaskMap(merged.headers, entry.config.headers)
        const rendered = renderDshEntry(entry.patchId, merged, 4)
        return { ok: true, text: spliceDshEntry(text, rendered, 'replace', entry.patchId) }
      }
      return { ok: false, error: `unsupported operation "${op}"` }
    }

    if (strategy === WRITE_STRATEGIES.tomlMcpServers) {
      const parsed = parseToml(text)
      if (parsed.errors.length > 0) return { ok: false, error: `the file does not parse (${parsed.errors[0]})` }
      const document = parsed.value ?? {}
      document.mcp_servers = document.mcp_servers ?? {}
      const existing = document.mcp_servers[name]
      if (!existing) return { ok: false, error: `"${name}" is not in ${source.label}` }
      if (op === 'toggle') {
        if (request.enabled === false) existing.enabled = false
        else delete existing.enabled
        return { ok: true, text: serializeTomlDocument(document) }
      }
      if (op === 'delete') {
        delete document.mcp_servers[name]
        return { ok: true, text: serializeTomlDocument(document) }
      }
      if (op === 'update') {
        const patch = request.server ?? {}
        if (patch.command !== undefined) existing.command = patch.command
        if (patch.url !== undefined) existing.url = patch.url
        if (patch.args !== undefined) existing.args = patch.args
        if (patch.env !== undefined) existing.env = unmaskMap(patch.env, existing.env)
        if (patch.cwd !== undefined) existing.cwd = patch.cwd
        return { ok: true, text: serializeTomlDocument(document) }
      }
      return { ok: false, error: `unsupported operation "${op}"` }
    }

    // JSON-shaped sources.
    let document
    try {
      document = JSON.parse(text)
    } catch (error) {
      return { ok: false, error: `the file is not valid JSON (${String(error?.message ?? error)})` }
    }
    const bucket = document.mcpServers ?? document.mcp_servers
    if (!bucket || !bucket[name]) return { ok: false, error: `"${name}" is not in ${source.label}` }
    if (op === 'toggle') {
      if (request.enabled === false) bucket[name].disabled = true
      else {
        delete bucket[name].disabled
        delete bucket[name].enabled
      }
      return { ok: true, text: JSON.stringify(document, null, 2) + '\n' }
    }
    if (op === 'delete') {
      delete bucket[name]
      return { ok: true, text: JSON.stringify(document, null, 2) + '\n' }
    }
    if (op === 'update') {
      const patch = request.server ?? {}
      const merged = { ...bucket[name] }
      if (patch.command !== undefined) merged.command = patch.command
      if (patch.url !== undefined) merged.url = patch.url
      if (patch.args !== undefined) merged.args = patch.args
      if (patch.env !== undefined) merged.env = unmaskMap(patch.env, bucket[name].env)
      if (patch.headers !== undefined) merged.headers = unmaskMap(patch.headers, bucket[name].headers)
      if (patch.cwd !== undefined) merged.cwd = patch.cwd
      if (patch.transport !== undefined) merged.type = patch.transport === 'stdio' ? (merged.type ?? undefined) : patch.transport
      if (merged.type === undefined) delete merged.type
      bucket[name] = JSON.parse(JSON.stringify(merged))
      return { ok: true, text: JSON.stringify(document, null, 2) + '\n' }
    }
    return { ok: false, error: `unsupported operation "${op}"` }
  }

  ctx.inject(['webServer'], (webCtx) => {
    const origin = (() => {
      try {
        return webCtx.webServer.getOrigin()
      } catch {
        return undefined
      }
    })()

    webCtx.effect(() => {
      const dispose = webCtx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        async handler(req, res) {
          if (!sameOrigin(req, origin)) {
            sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
            return
          }
          const url = new URL(req.url ?? '/', 'http://localhost')
          const route = url.pathname.slice(ROUTE_PREFIX.length) || '/'
          try {
            if (req.method === 'GET' && route === '/inventory') {
              sendJson(res, 200, { ok: true, data: scan(url.searchParams.get('refresh') === '1') })
              return
            }
            if (req.method === 'GET' && route === '/server') {
              const uid = url.searchParams.get('uid') ?? ''
              const inventory = scan()
              const server = inventory.servers.find((item) => item.uid === uid)
              if (!server) {
                sendJson(res, 404, { ok: false, error: `unknown server "${uid}"` })
                return
              }
              const target = locate(uid)
              let raw = null
              let errors = []
              if (!('error' in target)) {
                // Parse with the strategy the file is written with, then find
                // this exact declaration again to show live values.
                const strategy = target.source.strategy
                let parsed = { value: null, errors: [] }
                if (strategy === WRITE_STRATEGIES.dshPatch) {
                  parsed = parseYaml(target.text)
                  raw = dshPatchEntries(parsed.value)
                    .find((item) => item.patchId === server.patchId || String(item.config.serverName) === server.name)?.config ?? null
                } else if (strategy === WRITE_STRATEGIES.tomlMcpServers) {
                  parsed = parseToml(target.text)
                  raw = tomlMcpEntries(parsed.value).find((item) => item.name === server.name)?.raw ?? null
                } else {
                  try {
                    parsed = { value: JSON.parse(target.text), errors: [] }
                    raw = jsonMcpEntries(parsed.value).find((item) => item.name === server.name)?.raw ?? null
                  } catch (error) {
                    parsed = { value: null, errors: [`invalid JSON: ${String(error?.message ?? error)}`] }
                  }
                }
                errors = parsed.errors
                raw = raw === null ? null : maskDeclaration(raw)
              }
              const live = liveMcpTools()[server.name]
              const cacheKey = `${server.uid}`
              const cached = toolsCache.get(cacheKey)
              const tools = live?.tools ?? []
              if (!cached || Date.now() - cached.at > resolved.toolsTtlMs) {
                toolsCache.set(cacheKey, { at: Date.now(), tools })
              }
              sendJson(res, 200, {
                ok: true,
                data: {
                  server,
                  declaration: raw,
                  parseErrors: errors,
                  // The whole file is available through the /file route, which
                  // is the only place a user edits it; this view stays scoped
                  // to one declaration and never carries other secrets.
                  filePath: 'error' in target ? null : target.source.path,
                  connected: Boolean(live),
                  tools: live?.tools ?? cached?.tools ?? [],
                },
              })
              return
            }
            if (req.method === 'GET' && route === '/file') {
              const sourceId = url.searchParams.get('source') ?? ''
              const source = sourceById.get(sourceId)
              if (!source) {
                sendJson(res, 404, { ok: false, error: `unknown source "${sourceId}"` })
                return
              }
              if (!existsSync(source.path)) {
                sendJson(res, 200, { ok: true, data: { source, text: '', exists: false, validation: { ok: true, errors: [], servers: [] } } })
                return
              }
              const text = readFileSync(source.path, 'utf8')
              sendJson(res, 200, {
                ok: true,
                data: {
                  source,
                  exists: true,
                  text,
                  validation: validateText(text, source.strategy),
                },
              })
              return
            }
            if (req.method === 'GET' && route === '/backups') {
              sendJson(res, 200, { ok: true, data: { dir: backupRoot(), items: listBackups() } })
              return
            }
            if (req.method === 'POST' && route === '/validate') {
              const body = await readJsonBody(req)
              const source = sourceById.get(String(body.sourceId ?? ''))
              if (!source) {
                sendJson(res, 400, { ok: false, error: `unknown source "${body.sourceId}"` })
                return
              }
              sendJson(res, 200, { ok: true, data: validateText(String(body.text ?? ''), body.strategy ?? source.strategy) })
              return
            }
            if (req.method === 'POST' && route === '/save-file') {
              const body = await readJsonBody(req)
              const source = sourceById.get(String(body.sourceId ?? ''))
              if (!source) {
                sendJson(res, 400, { ok: false, error: `unknown source "${body.sourceId}"` })
                return
              }
              const result = safeWrite({
                path: source.path,
                text: String(body.text ?? ''),
                strategy: source.strategy,
                reason: String(body.reason ?? 'editor'),
                retain: resolved.retainBackups,
              })
              scanCache.at = 0
              sendJson(res, result.ok ? 200 : 400, { ok: result.ok, data: result, error: result.ok ? undefined : result.errors.join('; ') })
              return
            }
            if (req.method === 'POST' && route === '/mutate') {
              const body = await readJsonBody(req)
              const op = String(body.op ?? '')
              if (!['toggle', 'update', 'delete', 'add', 'import'].includes(op)) {
                sendJson(res, 400, { ok: false, error: `unsupported operation "${op}"` })
                return
              }
              if (op === 'add' || op === 'import') {
                const result = addServer(body, resolved.retainBackups)
                scanCache.at = 0
                sendJson(res, result.ok ? 200 : 400, { ok: result.ok, data: result, error: result.ok ? undefined : result.errors.join('; ') })
                return
              }
              const planned = nextText(body)
              if (!planned.ok) {
                sendJson(res, 400, { ok: false, error: planned.error })
                return
              }
              const target = locate(body.uid)
              if ('error' in target) {
                sendJson(res, 400, { ok: false, error: target.error })
                return
              }
              const result = safeWrite({
                path: target.source.path,
                text: planned.text,
                strategy: target.source.strategy,
                reason: op,
                retain: resolved.retainBackups,
              })
              scanCache.at = 0
              toolsCache.clear()
              sendJson(res, result.ok ? 200 : 400, {
                ok: result.ok,
                data: {
                  ...result,
                  reloadRequired: Boolean(lookupPatchId(body.uid)),
                  reloadMode: lookupPatchId(body.uid) ? 'profile' : 'application',
                },
                error: result.ok ? undefined : result.errors.join('; '),
              })
              return
            }
            if (req.method === 'GET' && route === '/restore') {
              sendJson(res, 405, { ok: false, error: 'use POST' })
              return
            }
            if (req.method === 'POST' && route === '/restore') {
              const body = await readJsonBody(req)
              const name = String(body.name ?? '')
              const dir = backupRoot()
              const full = join(dir, name)
              if (!name || !full.startsWith(dir) || !existsSync(full)) {
                sendJson(res, 400, { ok: false, error: 'unknown backup' })
                return
              }
              // A backup name encodes `<file>.<stamp>.<reason>.bak`; the file is
              // the piece before the ISO stamp.
              const targetName = name.split(/\.\d{4}-\d{2}-\d{2}T/)[0]
              const source = sources.find((item) => item.path && item.path.endsWith(`/${targetName}`) || (item.path && item.path.split('/').pop() === targetName))
              if (!source) {
                sendJson(res, 400, { ok: false, error: `cannot tell which file backup "${name}" belongs to` })
                return
              }
              const text = readFileSync(full, 'utf8')
              const result = safeWrite({ path: source.path, text, strategy: source.strategy, reason: 'restore', retain: resolved.retainBackups })
              scanCache.at = 0
              sendJson(res, result.ok ? 200 : 400, { ok: result.ok, data: { ...result, restoredTo: source.path }, error: result.ok ? undefined : result.errors.join('; ') })
              return
            }
            if (req.method === 'POST' && route === '/reload') {
              // Recompose the profile from the files on disk so toggles, edits
              // and added servers take effect without restarting the app.
              const hmr = ctx.get('hmr')
              if (!hmr || typeof hmr.reconcileProfile !== 'function') {
                sendJson(res, 200, {
                  ok: false,
                  error: 'this host exposes no profile reload; restart DeepSeek Harness to apply configuration changes',
                  data: { restartRequired: true },
                })
                return
              }
              const requiredIds = (await readJsonBody(req)).ids
              const ids = Array.isArray(requiredIds) ? requiredIds.map(String) : []
              // The HMR service requires reconciliation to be serialized with
              // its own reload paths; runExclusive is the gate it documents.
              const report = typeof hmr.runExclusive === 'function'
                ? await hmr.runExclusive(() => hmr.reconcileProfile(ids))
                : await hmr.reconcileProfile(ids)
              scanCache.at = 0
              toolsCache.clear()
              sendJson(res, 200, {
                ok: true,
                data: {
                  reloaded: true,
                  warnings: report?.warnings ?? [],
                  pending: report?.pending ?? [],
                  restartReason: report?.restartReason ?? null,
                  restartRequired: Boolean(report?.restartReason),
                },
              })
              return
            }
            sendJson(res, 404, { ok: false, error: `unknown route ${route}` })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      })
      return () => {
        dispose()
        scanCache.value = null
        toolsCache.clear()
      }
    })
  }, 'webServer')

  /**
   * The loader patch id behind a uid, when the server lives in a DSH patch.
   *
   * @param {string} uid - server id.
   * @returns {string | null} patch id.
   */
  function lookupPatchId(uid) {
    const inventory = scanCache.value ?? scan()
    return inventory.servers.find((item) => item.uid === uid)?.patchId ?? null
  }

  /**
   * Add a server to a source, or import a whole MCP JSON document.
   *
   * @param {object} body - the request.
   * @param {number} retain - backups to keep.
   * @returns {{ ok: boolean, errors: string[], added: string[], backup: string | null }} outcome.
   */
  function addServer(body, retain) {
    const source = sourceById.get(String(body.sourceId ?? 'dsh-profile'))
    if (!source) return { ok: false, errors: [`unknown source "${body.sourceId}"`], added: [], backup: null }
    const errors = []
    const added = []
    let backup = null
    let text = existsSync(source.path) ? readFileSync(source.path, 'utf8') : emptyTextFor(source)

    const drafts = Array.isArray(body.servers) ? body.servers : body.server ? [body.server] : []
    if (drafts.length === 0) return { ok: false, errors: ['nothing to add'], added: [], backup: null }

    if (source.strategy === WRITE_STRATEGIES.dshPatch) {
      const parsed = parseYaml(text)
      if (parsed.errors.length > 0) return { ok: false, errors: [`existing file does not parse: ${parsed.errors[0]}`], added: [], backup: null }
      const existing = dshPatchEntries(parsed.value)
      for (const draft of drafts) {
        const name = String(draft.name ?? '').trim()
        if (!name) {
          errors.push('a server needs a name')
          continue
        }
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) {
          errors.push(`"${name}": the host requires names matching ^[A-Za-z0-9_-]{1,32}$`)
          continue
        }
        if (existing.some((entry) => String(entry.config.serverName) === name)) {
          errors.push(`"${name}" already exists in ${source.app}`)
          continue
        }
        const patchId = String(draft.patchId ?? `mcp-${name}`)
        if (existing.some((entry) => entry.patchId === patchId)) {
          errors.push(`entry id "${patchId}" is already used`)
          continue
        }
        const rendered = renderDshEntry(patchId, draft, 4)
        text = spliceDshEntry(text, rendered, 'append')
        added.push(name)
      }
    } else if (source.strategy === WRITE_STRATEGIES.tomlMcpServers) {
      errors.push(`${source.app} uses TOML; edit its config.toml directly in the config tab`)
    } else {
      let document
      try {
        document = JSON.parse(text)
      } catch (error) {
        return { ok: false, errors: [`existing file is not valid JSON: ${String(error?.message ?? error)}`], added: [], backup: null }
      }
      document.mcpServers = document.mcpServers ?? {}
      for (const draft of drafts) {
        const name = String(draft.name ?? '').trim()
        if (!name) {
          errors.push('a server needs a name')
          continue
        }
        if (document.mcpServers[name]) {
          errors.push(`"${name}" already exists in ${source.app}`)
          continue
        }
        const entry = {}
        if (draft.transport === 'stdio' || draft.command) {
          entry.command = draft.command
          if (Array.isArray(draft.args) && draft.args.length > 0) entry.args = draft.args
          if (draft.env && Object.keys(draft.env).length > 0) entry.env = draft.env
        } else {
          entry.type = draft.transport === 'sse' ? 'sse' : 'http'
          entry.url = draft.url
          if (draft.headers && Object.keys(draft.headers).length > 0) entry.headers = draft.headers
        }
        document.mcpServers[name] = entry
        added.push(name)
      }
      text = JSON.stringify(document, null, 2) + '\n'
    }

    if (added.length === 0) return { ok: false, errors, added, backup: null }
    const result = safeWrite({ path: source.path, text, strategy: source.strategy, reason: 'add', retain })
    return { ok: result.ok, errors: [...errors, ...result.errors], added: result.ok ? added : [], backup: result.backup }
  }

  /**
   * Read the backup directory into a display list, newest first.
   *
   * @returns {Array<object>} backup records.
   */
  function listBackups() {
    const dir = backupRoot()
    if (!existsSync(dir)) return []
    try {
      return readdirSync(dir)
        .filter((name) => name.endsWith('.bak'))
        .map((name) => {
          const info = statSync(join(dir, name))
          return { name, size: info.size, mtime: info.mtimeMs }
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 200)
    } catch {
      return []
    }
  }
}

/**
 * The document text a source should start from when it does not exist yet.
 *
 * @param {object} source - catalogue entry.
 * @returns {string} empty document text.
 */
function emptyTextFor(source) {
  if (source.strategy === WRITE_STRATEGIES.dshPatch) return '# MCP servers added by MCP Manager.\n[]\n'
  if (source.strategy === WRITE_STRATEGIES.tomlMcpServers) return ''
  return JSON.stringify({ mcpServers: {} }, null, 2) + '\n'
}

/**
 * Serialise a TOML document back to text.
 *
 * Scalars and tables are written in the order they were read; nested tables
 * become `[a.b]` headers, which is how Codex writes them.
 *
 * @param {Record<string, unknown>} document - the document.
 * @returns {string} TOML text.
 */
function serializeTomlDocument(document) {
  const lines = []
  const scalar = (value) => {
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return `[${value.map((item) => scalar(item)).join(', ')}]`
    // JSON string escaping is a valid TOML basic string for our value shapes.
    return JSON.stringify(String(value))
  }
  const key = (name) => (/^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name))

  const walk = (object, path) => {
    const scalars = []
    const tables = []
    for (const [name, value] of Object.entries(object ?? {})) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) tables.push([name, value])
      else scalars.push([name, value])
    }
    if (path.length > 0) lines.push(`[${path.map(key).join('.')}]`)
    for (const [name, value] of scalars) lines.push(`${key(name)} = ${scalar(value)}`)
    if (scalars.length > 0) lines.push('')
    for (const [name, value] of tables) walk(value, [...path, name])
  }
  walk(document, [])
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** File this module resolves, used for diagnostics only. */
export const moduleFile = fileURLToPath(import.meta.url)

/** Plugin name for the loader. */
export const name = 'dsh-mcp-manager'
