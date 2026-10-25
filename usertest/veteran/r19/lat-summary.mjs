// 反応時間 A/B の json（13-latency-ab-*・28-latency-new・52-load-ab）を中央値の表にする。キーの「r13」は 5198（ここでは r15 ビルド）、「current」は 5197（現行）
import fs from 'node:fs'
const med = (a) => { const b = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null }
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'))
  console.log('##', f)
  const all = d.all ?? d
  const keys = Object.keys(all).filter((k) => Array.isArray(all[k]))
  for (const k of keys) {
    const runs = all[k]
    if (typeof runs[0] === 'number') { console.log(k, 'median', med(runs)); continue }
    const out = {}
    const walk = (o, p) => { for (const [kk, v] of Object.entries(o)) { if (typeof v === 'number') (out[p + kk] ??= []).push(v); else if (v && typeof v === 'object') walk(v, p + kk + '.') } }
    for (const r of runs) walk(r, '')
    console.log(k, Object.entries(out).map(([kk, v]) => `${kk}=${med(v)}`).join(' '))
  }
}
