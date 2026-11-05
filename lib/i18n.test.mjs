/**
 * Keeps the two copies of the UI dictionary honest.
 *
 * `client.js` embeds the dictionary because the browser half must load as one
 * self-contained module; `lib/i18n.js` holds the readable source. They are the
 * same data, so a drift between them is a build error, not a style choice.
 *
 * Run: node lib/i18n.test.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TEXT as LIB_TEXT } from './i18n.js'

const here = dirname(fileURLToPath(import.meta.url))
const clientSource = readFileSync(join(here, '..', 'client.js'), 'utf8')

/** Flatten a dictionary into dotted key paths. */
function keyPaths(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' ? keyPaths(child, `${prefix}${key}.`) : [`${prefix}${key}`])
}

/** Pull the embedded literal out of client.js. */
function clientDictionary() {
  const start = clientSource.indexOf('const TEXT = {')
  if (start === -1) throw new Error('client.js no longer declares a TEXT dictionary')
  const open = clientSource.indexOf('{', start)
  let depth = 0
  for (let index = open; index < clientSource.length; index += 1) {
    if (clientSource[index] === '{') depth += 1
    else if (clientSource[index] === '}') {
      depth -= 1
      if (depth === 0) {
        const literal = clientSource.slice(start + 'const TEXT = '.length, index + 1)
        return new Function(`return (${literal})`)()
      }
    }
  }
  throw new Error('unterminated TEXT literal in client.js')
}

let failures = 0
const check = (label, ok, detail) => {
  if (ok) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('i18n consistency')

const client = clientDictionary()
const languages = Object.keys(LIB_TEXT)

check('same language set', [...languages].sort().join() === Object.keys(client).sort().join(),
  `lib=${languages.join()} client=${Object.keys(client).join()}`)

for (const lang of languages) {
  const libKeys = keyPaths(LIB_TEXT[lang]).sort()
  const clientKeys = keyPaths(client[lang] ?? {}).sort()
  const onlyLib = libKeys.filter((key) => !clientKeys.includes(key))
  const onlyClient = clientKeys.filter((key) => !libKeys.includes(key))
  check(`${lang}: same keys (${libKeys.length})`, onlyLib.length === 0 && onlyClient.length === 0,
    [onlyLib.length ? `only lib: ${onlyLib.slice(0, 4).join(', ')}` : '', onlyClient.length ? `only client: ${onlyClient.slice(0, 4).join(', ')}` : '']
      .filter(Boolean).join('; '))

  // A function-valued entry must be callable with the same arity in both copies.
  const flat = (value, prefix = '', out = {}) => {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'function') out[`${prefix}${key}`] = child
      else if (child && typeof child === 'object') flat(child, `${prefix}${key}.`, out)
    }
    return out
  }
  const libFns = flat(LIB_TEXT[lang])
  const clientFns = flat(client[lang] ?? {})
  const arityMismatch = Object.keys(libFns).filter((key) => typeof clientFns[key] !== 'function'
    || clientFns[key].length !== libFns[key].length)
  check(`${lang}: function arity matches`, arityMismatch.length === 0, arityMismatch.slice(0, 4).join(', '))
}

check('Chinese is the default dictionary', LIB_TEXT.zh !== undefined && typeof LIB_TEXT.zh.appTitle === 'string')
check('Chinese copy is actually Chinese', /[\u4e00-\u9fa5]/.test(LIB_TEXT.zh.nav.home) && /[\u4e00-\u9fa5]/.test(LIB_TEXT.zh.home.statServers(1, 2)))
check('English copy is not Chinese', !/[\u4e00-\u9fa5]/.test(LIB_TEXT.en.nav.home))

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
