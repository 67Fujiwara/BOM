// ラウンド19: 結果の .json（と .log の JSON 行）にある console error / pageerror を集める（dialog は除く）。node 149-console-errors.mjs
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/veteran/r20'
const out = {}
const walk = (v, f, path = '') => {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, f, path))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (/^(errs|errors|consoleErrors|pageErrors)$/.test(k) && Array.isArray(x)) for (const e of x) { const t = typeof e === 'string' ? e : (e?.type === 'dialog' ? null : `${e?.type ?? ''} ${e?.text ?? JSON.stringify(e)}`); if (t && !/^dialog/.test(t)) (out[f] ??= new Set()).add(t.slice(0, 200)) }
    else walk(x, f, path + '.' + k)
  }
}
for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.json') && !/^(146-diff|149-)/.test(x))) { try { walk(JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8')), f) } catch {} }
for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.log'))) for (const l of fs.readFileSync(`${D}/${f}`, 'utf8').split('\n')) { if (/pageerror|console error|Uncaught/i.test(l) && !l.startsWith('{')) (out[f] ??= new Set()).add(l.slice(0, 200)); if (l.startsWith('{')) { try { walk(JSON.parse(l), f) } catch {} } }
const res = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]))
fs.writeFileSync(`${D}/149-console-errors.json`, JSON.stringify(res, null, 2))
console.log(Object.keys(res).length, 'files with errors'); for (const [k, v] of Object.entries(res)) console.log(k, '|', v.slice(0, 3).join(' ‖ '))
