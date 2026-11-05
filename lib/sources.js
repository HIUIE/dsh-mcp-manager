/**
 * Source discovery and configuration parsing for MCP Manager.
 *
 * This module is deliberately free of Cordis and HTTP imports: it reads the
 * real configuration files of every MCP-speaking application on the machine,
 * normalises each entry into one shape, and hands plain JSON to the Host half.
 * Everything here is read-only; writes live in `writer.js`.
 *
 * @module dsh-mcp-manager/lib/sources
 */

import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Environment variable names that hold a secret rather than ordinary config. */
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|CREDENTIAL|AUTH|PRIVATE|SIGNATURE|COOKIE|SESSION|BEARER)/i

/** Values that look like embedded credentials even under an innocent key name. */
const SECRET_VALUE = /^(bearer\s+\S{12,}|[A-Za-z0-9_-]{32,}|sk-[A-Za-z0-9_-]{16,}|btmcp_[\w-]{16,}|ghp_[\w]{20,})/

/**
 * Whether a name/value pair must be masked in every payload the browser sees.
 *
 * @param {string} name - the env or header key.
 * @param {string} value - its value.
 * @returns {boolean} true when the value is a secret.
 */
export function isSecret(name, value) {
  if (SECRET_NAME.test(name)) return true
  return typeof value === 'string' && SECRET_VALUE.test(value.trim())
}

/**
 * Mask credential segments that appear inside a URL path.
 *
 * Many hosted MCP endpoints embed a token in the path
 * (`/bt-mcp-<token>/mcp`, `/<project>/<api-key>/sse`); showing the URL verbatim
 * would leak it, and showing nothing would make the endpoint unusable.
 *
 * @param {string | null | undefined} url - the endpoint.
 * @returns {{ value: string, redacted: boolean }} the displayable URL.
 */
export function maskUrl(url) {
  const text = String(url ?? '')
  if (!text) return { value: '', redacted: false }
  let redacted = false
  const masked = text.replace(/\/([A-Za-z0-9_-]{16,})(?=\/|$)/g, (match, segment) => {
    // Prose-like segments (`documentation`, `streamable-http`) are path names,
    // not credentials; mixed-case, digit-bearing or prefixed segments are not.
    const looksOpaque = /[A-Z]/.test(segment) || /\d/.test(segment) || /^[a-z]{1,8}[-_][A-Za-z0-9_-]{10,}$/.test(segment)
    if (!looksOpaque) return match
    redacted = true
    return `/${segment.slice(0, 6)}\u2022\u2022\u2022\u2022\u2022\u2022`
  })
  return { value: masked, redacted }
}

/**
 * Mask a secret for display while keeping enough of it to be recognisable.
 *
 * @param {string} value - the raw secret.
 * @returns {string} the masked form.
 */
export function maskValue(value) {
  const text = String(value ?? '')
  if (text.length <= 8) return '••••••'
  return `${text.slice(0, 4)}••••${text.slice(-4)}`
}

/* ------------------------------------------------------------------------ */
/* Lightweight YAML reader                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Parse the subset of YAML a loader patch uses: block mappings and sequences,
 * plain and quoted scalars, flow arrays/objects, block scalars, and comments.
 *
 * A full YAML parser is the right tool where one is available; this reader
 * exists so the dashboard still works in a profile that does not ship one. It
 * reports its own failures instead of guessing.
 *
 * @param {string} text - YAML source.
 * @returns {{ value: unknown, errors: string[] }} the parsed document and any problems.
 */
export function parseYaml(text) {
  const errors = []
  const lines = []
  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    lines.push({ indent: raw.length - raw.trimStart().length, text: raw.trimEnd(), line: index + 1 })
  }
  if (lines.length === 0) return { value: null, errors }

  /** Strip an unquoted trailing comment, keeping `#` inside quotes. */
  const stripComment = (value) => {
    let quote = null
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i]
      if (quote) {
        if (ch === '\\' && quote === '"') i += 1
        else if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") quote = ch
      else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trimEnd()
    }
    return value.trimEnd()
  }

  /**
   * Whether a raw scalar opens a quote it does not close on the same line.
   *
   * @param {string} raw - the scalar text.
   * @returns {'"' | "'" | null} the open quote, if any.
   */
  const unclosedQuote = (raw) => {
    const value = raw.trim()
    if (value.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(value)) return '"'
    if (value.startsWith("'") && !/^'(?:[^']|'')*'$/.test(value)) return "'"
    return null
  }

  const parseScalar = (raw, line) => {
    const value = stripComment(raw).trim()
    if (value === '' || value === 'null' || value === '~' || value === 'Null' || value === 'NULL') return null
    if (/^true$/i.test(value)) return true
    if (/^false$/i.test(value)) return false
    const js = /^!!js\s+(.*)$/s.exec(value)
    if (js) return { __jsExpr: js[1] }
    if (value.startsWith('"')) {
      if (!value.endsWith('"') || value.length < 2) {
        errors.push(`line ${line}: unterminated double-quoted string`)
        return value.slice(1)
      }
      try {
        return JSON.parse(value)
      } catch {
        return value.slice(1, -1)
      }
    }
    if (value.startsWith("'")) {
      if (!value.endsWith("'") || value.length < 2) {
        errors.push(`line ${line}: unterminated single-quoted string`)
        return value.slice(1)
      }
      return value.slice(1, -1).replace(/''/g, "'")
    }
    if (value.startsWith('[') || value.startsWith('{')) {
      const close = value[0] === '[' ? ']' : '}'
      if (!value.endsWith(close)) {
        errors.push(`line ${line}: unterminated flow collection`)
        return value
      }
      try {
        return JSON.parse(value.replace(/([{,]\s*)([A-Za-z_][\w.-]*)(\s*:)/g, '$1"$2"$3'))
      } catch {
        return value
      }
    }
    if (/^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10)
    if (/^[+-]?\d*\.\d+$/.test(value)) return Number.parseFloat(value)
    return value
  }

  /**
   * Parse one block starting at `from` with the given indentation.
   *
   * Every call advances `from` by at least one line, which is what makes the
   * whole reader terminate on malformed input; a step budget caps total work.
   */
  let budget = 40 + lines.length * 60
  const spend = () => {
    budget -= 1
    if (budget < 0) throw new Error('document is malformed or too deeply nested')
  }

  const readBlockScalar = (parentIndent, from) => {
    const body = []
    let at = from
    while (at < lines.length && lines[at].indent > parentIndent) {
      body.push(lines[at].text.trim())
      at += 1
    }
    return { text: body.join('\n'), next: at }
  }

  const readValue = (rest, indent, line, from) => {
    let inline = stripComment(rest).trim()
    const open = unclosedQuote(inline)
    if (open !== null) {
      // YAML folds a quoted scalar across lines; join until the quote closes.
      let at = from
      let joined = inline
      while (at < lines.length) {
        spend()
        const piece = lines[at].text.trim()
        at += 1
        joined += ' '
        // A trailing `'` in a single-quoted scalar is an escaped quote, so only
        // treat it as the closer when what follows does not continue the word.
        joined += piece
        if (unclosedQuote(joined) === null) break
      }
      inline = joined
      from = at
    }
    if (inline.startsWith('|') || inline.startsWith('>')) {
      const body = readBlockScalar(indent, from)
      return { value: inline.startsWith('>') ? body.text.replace(/\n/g, ' ') : body.text, next: body.next }
    }
    if (inline !== '') return { value: parseScalar(inline, line), next: from }
    if (from < lines.length && lines[from].indent > indent) {
      const nested = parseBlock(from)
      return { value: nested.value, next: nested.next }
    }
    return { value: null, next: from }
  }

  const splitKey = (body) => {
    const match = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:][^:]*?)\s*:(?:\s+(.*))?$/.exec(body)
    if (!match) return null
    let key = match[1]
    if (key.startsWith('"')) {
      try {
        key = JSON.parse(key)
      } catch {
        key = key.slice(1, -1)
      }
    } else if (key.startsWith("'")) key = key.slice(1, -1).replace(/''/g, "'")
    return { key, rest: match[2] ?? '' }
  }

  const parseBlock = (from) => {
    spend()
    if (from >= lines.length) return { value: null, next: lines.length }
    return lines[from].text.trim().startsWith('-') ? parseSeq(from) : parseMap(from)
  }

  const parseMap = (from) => {
    spend()
    const indent = lines[from].indent
    const object = {}
    let at = from
    let consumed = false
    while (at < lines.length && lines[at].indent === indent && !lines[at].text.trim().startsWith('-')) {
      const current = lines[at]
      const parsed = splitKey(current.text.trim())
      at += 1
      consumed = true
      if (parsed === null) {
        errors.push(`line ${current.line}: expected "key: value"`)
        continue
      }
      const value = readValue(parsed.rest, indent, current.line, at)
      object[parsed.key] = value.value
      at = value.next
    }
    // Never leave a block without consuming at least one line.
    return { value: object, next: consumed ? at : from + 1 }
  }

  const parseSeq = (from) => {
    spend()
    const indent = lines[from].indent
    const array = []
    let at = from
    let consumed = false
    while (at < lines.length && lines[at].indent === indent && lines[at].text.trim().startsWith('-')) {
      const current = lines[at]
      const body = current.text.trim()
      const item = body.slice(1).trim()
      consumed = true
      if (item === '') {
        at += 1
        if (at < lines.length && lines[at].indent > indent) {
          const nested = parseBlock(at)
          array.push(nested.value)
          at = nested.next
        } else array.push(null)
        continue
      }
      const parsed = splitKey(item)
      if (parsed !== null) {
        // `- key: value` starts a mapping whose sibling keys indent to `key`.
        const synthetic = indent + (body.length - item.length)
        const object = {}
        at += 1
        // `- key:` may open a nested sequence or mapping at a deeper indent;
        // readValue handles that because it compares against `synthetic`.
        // The nested block's indentation only has to exceed the `-` line's.
        const first = readValue(parsed.rest, indent, current.line, at)
        object[parsed.key] = first.value
        at = first.next
        while (at < lines.length && lines[at].indent === synthetic && !lines[at].text.trim().startsWith('-')) {
          const follower = lines[at]
          const next = splitKey(follower.text.trim())
          at += 1
          if (next === null) {
            errors.push(`line ${follower.line}: expected "key: value"`)
            continue
          }
          const value = readValue(next.rest, synthetic, follower.line, at)
          object[next.key] = value.value
          at = value.next
        }
        array.push(object)
        continue
      }
      // A scalar list item still goes through readValue: it may open a quote
      // that closes on a later line.
      const scalar = readValue(item, indent, current.line, at + 1)
      array.push(scalar.value)
      at = Math.max(scalar.next, at + 1)
    }
    return { value: array, next: consumed ? at : from + 1 }
  }

  try {
    const result = parseBlock(0)
    if (result.next < lines.length) errors.push(`line ${lines[result.next].line}: unexpected indentation`)
    return { value: result.value, errors }
  } catch (error) {
    return { value: null, errors: [...errors, String(error?.message ?? error)] }
  }
}

/* ------------------------------------------------------------------------ */
/* Minimal TOML reader (Codex `config.toml`)                                 */
/* ------------------------------------------------------------------------ */

/**
 * Parse the TOML a Codex config needs: tables, dotted table headers, strings,
 * numbers, booleans, inline arrays, and inline tables.
 *
 * @param {string} text - TOML source.
 * @returns {{ value: Record<string, unknown>, errors: string[] }} the document.
 */
export function parseToml(text) {
  const root = {}
  const errors = []
  let table = root
  const lines = text.split(/\r?\n/)

  const unquote = (raw) => {
    const value = raw.trim()
    if (value.startsWith('""') || value.startsWith("''")) {
      const quote = value.slice(0, 3)
      return value.slice(3, value.lastIndexOf(quote))
    }
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value.slice(0, value.lastIndexOf('"') + 1))
      } catch {
        return value.slice(1, -1)
      }
    }
    if (value.startsWith("'")) return value.slice(1, -1)
    return value
  }

  const assign = (path, value) => {
    let target = table
    for (const part of path) {
      if (typeof target[part] !== 'object' || target[part] === null || Array.isArray(target[part])) target[part] = {}
      target = target[part]
    }
    return () => {}
  }


  const splitTopLevel = (text2) => {
    const parts = []
    let depth = 0
    let quote = null
    let current = ''
    for (const ch of text2) {
      if (quote) {
        current += ch
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        current += ch
        continue
      }
      if (ch === '[' || ch === '{') depth += 1
      if (ch === ']' || ch === '}') depth -= 1
      if (ch === ',' && depth === 0) {
        parts.push(current)
        current = ''
        continue
      }
      current += ch
    }
    if (current.trim() !== '') parts.push(current)
    return parts.map((part) => part.trim()).filter(Boolean)
  }

  const parseValue = (raw) => {
    const value = raw.trim()
    if (value === '' ) return ''
    if (value === 'true') return true
    if (value === 'false') return false
    if (value.startsWith('[')) {
      const inner = value.slice(1, value.lastIndexOf(']'))
      return splitTopLevel(inner).map((item) => parseValue(item))
    }
    if (value.startsWith('{')) {
      const inner = value.slice(1, value.lastIndexOf('}'))
      const object = {}
      for (const part of splitTopLevel(inner)) {
        const split = part.indexOf('=')
        if (split === -1) continue
        object[unquote(part.slice(0, split))] = parseValue(part.slice(split + 1))
      }
      return object
    }
    if (/^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10)
    if (/^[+-]?\d*\.\d+$/.test(value)) return Number.parseFloat(value)
    return unquote(value)
  }

  const parseKeyPath = (raw) => {
    const parts = []
    let current = ''
    let quote = null
    for (const ch of raw) {
      if (quote) {
        current += ch
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        current += ch
        continue
      }
      if (ch === '.') {
        if (current.trim() !== '') parts.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    if (current.trim() !== '') parts.push(current.trim())
    return parts.map((part) => {
      const text2 = part.trim()
      const quoted = text2.length >= 2
        && ((text2.startsWith('"') && text2.endsWith('"')) || (text2.startsWith("'") && text2.endsWith("'")))
      return quoted ? unquote(text2) : text2
    })
  }

  /** Walk (and create) the table a dotted key path names. */
  const ensurePath = (parts) => {
    let parent = root
    for (const part of parts) {
      const existing = parent[part]
      if (Array.isArray(existing)) {
        // A dotted path through an array-of-tables targets its last element.
        parent = existing[existing.length - 1] ?? {}
        if (existing.length === 0) existing.push(parent)
        continue
      }
      if (typeof existing !== 'object' || existing === null) parent[part] = {}
      parent = parent[part]
    }
    return parent
  }

  /** Read a value that may span several lines because of brackets. */
  let cursor = 0
  const readValue = (inline) => {
    let text2 = inline
    let depth = 0
    let quote = null
    const scan = (chunk) => {
      for (const ch of chunk) {
        if (quote) {
          if (ch === quote) quote = null
          continue
        }
        if (ch === '"' || ch === "'") quote = ch
        else if (ch === '[' || ch === '{') depth += 1
        else if (ch === ']' || ch === '}') depth -= 1
      }
    }
    scan(text2)
    while (depth > 0 && cursor < lines.length) {
      const next = lines[cursor].trim()
      cursor += 1
      text2 += ' ' + next
      scan(next)
    }
    return text2
  }

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor].trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('[[')) {
      const path = parseKeyPath(line.slice(2, line.indexOf(']]')))
      const parent = ensurePath(path.slice(0, -1))
      const last = path[path.length - 1]
      if (!Array.isArray(parent[last])) parent[last] = []
      const entry = {}
      parent[last].push(entry)
      table = entry
      continue
    }
    if (line.startsWith('[')) {
      table = ensurePath(parseKeyPath(line.slice(1, line.indexOf(']'))))
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) {
      errors.push(`line ${cursor + 1}: expected "key = value"`)
      continue
    }
    const path = parseKeyPath(line.slice(0, eq))
    if (path.length === 0) continue
    try {
      const raw = readValue(line.slice(eq + 1))
      const value = parseValue(raw)
      if (path.length === 1) {
        // A bare key belongs to the table header currently in effect.
        table[path[0]] = value
      } else {
        // A dotted key nests below that same header.
        let parent = table
        for (const part of path.slice(0, -1)) {
          if (typeof parent[part] !== 'object' || parent[part] === null || Array.isArray(parent[part])) parent[part] = {}
          parent = parent[part]
        }
        parent[path[path.length - 1]] = value
      }
    } catch (error) {
      errors.push(`line ${cursor + 1}: ${String(error?.message ?? error)}`)
    }
  }
  void assign
  return { value: root, errors }
}

/* ------------------------------------------------------------------------ */
/* Source catalogue                                                          */
/* ------------------------------------------------------------------------ */

/** How a source's file is edited back. */
export const WRITE_STRATEGIES = {
  /** DSH profile patch / loader YAML with `insert:` entry lists. */
  dshPatch: 'dshPatch',
  /** Plain `{ "mcpServers": { … } }` JSON, the Claude/Cursor/Windsurf shape. */
  jsonMcpServers: 'jsonMcpServers',
  /** Gemini's `{ "mcpServers": … }` embedded in a larger settings document. */
  jsonSettings: 'jsonSettings',
  /** Codex `config.toml` `[mcp_servers.*]` tables. */
  tomlMcpServers: 'tomlMcpServers',
}

/**
 * Every application this machine may have configured MCP servers in.
 *
 * `kind` is `host` for the application currently running the dashboard, and
 * `other` for every tool whose configuration we can still read and write so a
 * user can move a server between them.
 *
 * @returns {Array<object>} the catalogue, in display order.
 */
export function sourceCatalogue() {
  const home = homedir()
  const dshHome = process.env.DSH_HOME ?? join(home, '.dsh')
  const profileDir = process.env.DSH_PROFILE_DIR
  const appSupport = join(home, 'Library', 'Application Support')
  const list = []

  const push = (entry) => {
    if (!entry.path) return
    list.push({ ...entry, exists: existsSync(entry.path) })
  }

  // The running profile's own patch layer: the highest-priority DSH source.
  push({
    id: 'dsh-profile',
    app: 'DeepSeek Harness',
    appId: 'dsh',
    kind: 'host',
    label: 'Profile patch',
    path: profileDir ? join(profileDir, 'cordis.patch.yml') : undefined,
    format: 'yaml',
    strategy: WRITE_STRATEGIES.dshPatch,
    note: 'This profile\'s cordis.patch.yml. Entries here win over bundles and the user patch.',
  })

  // The user-level patch: applies to every profile.
  push({
    id: 'dsh-user',
    app: 'DeepSeek Harness',
    appId: 'dsh',
    kind: 'host',
    label: 'User patch (all profiles)',
    path: join(dshHome, 'cordis.patch.yml'),
    format: 'yaml',
    strategy: WRITE_STRATEGIES.dshPatch,
    note: 'User-level cordis.patch.yml, applied to every profile.',
  })

  const otherApps = [
    { id: 'claude-code', app: 'Claude Code', appId: 'claude-code', label: 'User config', path: join(home, '.claude.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'claude-desktop', app: 'Claude Desktop', appId: 'claude-desktop', label: 'App config', path: join(appSupport, 'Claude', 'claude_desktop_config.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'codex', app: 'Codex', appId: 'codex', label: 'config.toml', path: join(home, '.codex', 'config.toml'), format: 'toml', strategy: WRITE_STRATEGIES.tomlMcpServers },
    { id: 'cursor', app: 'Cursor', appId: 'cursor', label: 'Global MCP', path: join(home, '.cursor', 'mcp.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'gemini', app: 'Gemini CLI', appId: 'gemini', label: 'settings.json', path: join(home, '.gemini', 'settings.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonSettings },
    { id: 'codebuddy', app: 'CodeBuddy', appId: 'codebuddy', label: 'mcp.json', path: join(home, '.codebuddy', 'mcp.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'cline', app: 'Cline', appId: 'cline', label: 'mcp.json', path: join(appSupport, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'windsurf', app: 'Windsurf', appId: 'windsurf', label: 'mcp_config.json', path: join(home, '.codeium', 'windsurf', 'mcp_config.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonMcpServers },
    { id: 'continue', app: 'Continue', appId: 'continue', label: 'config.json', path: join(home, '.continue', 'config.json'), format: 'json', strategy: WRITE_STRATEGIES.jsonSettings },
  ]
  for (const entry of otherApps) push({ ...entry, kind: 'other', note: 'Read from another application\'s own configuration.' })

  for (const entry of list) {
    try {
      entry.size = entry.exists ? statSync(entry.path).size : 0
      entry.mtime = entry.exists ? statSync(entry.path).mtimeMs : 0
    } catch {
      entry.size = 0
      entry.mtime = 0
    }
  }
  return list
}

/* ------------------------------------------------------------------------ */
/* Normalisation                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Classify a transport from whatever the source file called it.
 *
 * @param {object} raw - one server declaration.
 * @returns {'stdio' | 'streamable-http' | 'sse' | 'http' | 'unknown'} the transport.
 */
export function detectTransport(raw) {
  const declared = String(raw.type ?? raw.transport ?? '').toLowerCase()
  if (declared === 'stdio' || declared === 'local') return 'stdio'
  if (declared === 'sse') return 'sse'
  if (declared === 'http' || declared === 'streamable-http' || declared === 'http-stream') return 'streamable-http'
  if (raw.command) return 'stdio'
  const url = String(raw.url ?? raw.serverUrl ?? raw.httpUrl ?? '')
  if (/\/sse\/?$/.test(url)) return 'sse'
  if (url) return 'streamable-http'
  return 'unknown'
}

/**
 * Mask every secret in an env/header map, keeping key order and names.
 *
 * @param {Record<string, unknown> | undefined} map - the raw map.
 * @param {boolean} reveal - true to return raw values (Host-side use only).
 * @returns {Array<{ name: string, value: string, secret: boolean }>} display rows.
 */
export function entriesOf(map, reveal = false) {
  if (!map || typeof map !== 'object') return []
  return Object.entries(map).map(([name, value]) => {
    const text = value === null || value === undefined ? '' : String(value)
    const secret = isSecret(name, text)
    return { name, value: secret && !reveal ? maskValue(text) : text, secret }
  })
}

/**
 * Normalise one source-declared server into the shape the dashboard renders.
 *
 * @param {object} input - raw declaration plus context.
 * @param {string} input.name - the server key in its file.
 * @param {object} input.raw - the declaration object.
 * @param {object} input.source - the owning source from `sourceCatalogue`.
 * @param {string} [input.patchId] - loader entry id, for DSH sources.
 * @param {boolean} [input.enabled] - declared enablement.
 * @returns {object} the normalised server record.
 */
export function normaliseServer({ name, raw, source, patchId, enabled, reveal = false }) {
  const declaration = raw && typeof raw === 'object' ? raw : {}
  const transport = detectTransport(declaration)
  const env = declaration.env ?? declaration.env_vars ?? declaration.environment ?? {}
  const args = Array.isArray(declaration.args) ? declaration.args.map((item) => String(item)) : []
  const headers = declaration.headers ?? declaration.httpHeaders ?? {}
  return {
    uid: `${source.id}:${name}`,
    name,
    patchId: patchId ?? null,
    sourceId: source.id,
    sourceLabel: source.label,
    app: source.app,
    appId: source.appId,
    kind: source.kind,
    transport,
    // `declared` is what the file says; `reachable` is filled in by the Host
    // after asking the running MCP client. They are never conflated.
    declared: enabled !== false,
    status: enabled === false ? 'disabled' : 'enabled',
    command: declaration.command ? String(declaration.command) : null,
    args,
    // `url` is the displayable form; `rawUrl` is never sent outside the Host.
    url: maskUrl(declaration.url ?? declaration.serverUrl).value || null,
    urlRedacted: maskUrl(declaration.url ?? declaration.serverUrl).redacted,
    cwd: declaration.cwd ? String(declaration.cwd) : null,
    env: entriesOf(env, reveal),
    headers: entriesOf(headers, reveal),
    hasSecrets: entriesOf(env).some((row) => row.secret) || entriesOf(headers).some((row) => row.secret),
    reconnect: declaration.reconnect ?? null,
    toolCallTimeoutMs: declaration.toolCallTimeoutMs ?? null,
    // The raw declaration stays inside the Host; it can hold live credentials.
    raw: reveal ? declaration : undefined,
  }
}

/**
 * Extract DSH loader-patch MCP entries from a parsed YAML document.
 *
 * A patch is an array of `{ insert: [entry…] }` / `{ id, config }` rows; an MCP
 * server is any row whose plugin name is the MCP client and whose config names
 * a server.
 *
 * @param {unknown} document - parsed patch document.
 * @returns {Array<{ patchId: string, config: object, disabled: boolean, lineStyle: string }>} entries.
 */
export function dshPatchEntries(document) {
  const entries = []
  const arrays = Array.isArray(document) ? document : document && typeof document === 'object' ? [document] : []
  for (const row of arrays) {
    if (!row || typeof row !== 'object') continue
    const inserts = Array.isArray(row.insert) ? row.insert : []
    const candidates = inserts.length > 0 ? inserts : [row]
    for (const entry of candidates) {
      if (!entry || typeof entry !== 'object') continue
      const pluginName = String(entry.name ?? '')
      const config = entry.config && typeof entry.config === 'object' ? entry.config : {}
      if (!/dsh-mcp-client/.test(pluginName)) continue
      if (!config.serverName) continue
      entries.push({
        patchId: String(entry.id ?? `${config.serverName}`),
        config,
        disabled: entry.disabled === true,
      })
    }
  }
  return entries
}

/**
 * Extract `mcpServers` entries from any JSON-shaped config document.
 *
 * @param {unknown} document - parsed JSON document.
 * @returns {Array<{ name: string, raw: object, enabled: boolean }>} declarations.
 */
export function jsonMcpEntries(document) {
  if (!document || typeof document !== 'object') return []
  const servers = document.mcpServers ?? document.mcp_servers
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return []
  return Object.entries(servers)
    .filter(([, raw]) => raw && typeof raw === 'object')
    .map(([name, raw]) => ({
      name,
      raw,
      enabled: raw.disabled !== true && raw.enabled !== false,
    }))
}

/**
 * Extract `[mcp_servers.*]` tables from a parsed Codex TOML document.
 *
 * @param {unknown} document - parsed TOML document.
 * @returns {Array<{ name: string, raw: object, enabled: boolean }>} declarations.
 */
export function tomlMcpEntries(document) {
  if (!document || typeof document !== 'object') return []
  const servers = document.mcp_servers
  if (!servers || typeof servers !== 'object') return []
  return Object.entries(servers)
    .filter(([, raw]) => raw && typeof raw === 'object')
    .map(([name, raw]) => ({
      name,
      // Codex keeps env under `.env`; `env_vars` names inherited variables only.
      raw: { ...raw, env: raw.env ?? {} },
      enabled: raw.enabled !== false,
    }))
}
