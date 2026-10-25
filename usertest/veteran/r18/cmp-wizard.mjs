// ガイドの .xlsx（wizard の json）と直接呼んだ結果（probe の json）を突き合わせる。node cmp-wizard.mjs wizard.json probe.json
import fs from 'node:fs'
const [w, p] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
let mis = 0
for (const x of w) {
  const y = p.find((z) => z.id === x.id); if (!y) continue
  const a = (x.created?.sample ?? []).join(' ‖ '), b = y.rows.slice(0, 8).map((r) => r.split(' / ').slice(0, 4).join(' / ')).join(' ‖ ')
  const ok = x.created?.rows === y.n && a === b
  if (!ok) { mis++; console.log(`不一致 ${x.id}\n  wizard ${x.created?.rows}: ${a}\n  direct ${y.n}: ${b}`) }
}
console.log(`不一致 ${mis} / ${w.length}`)
