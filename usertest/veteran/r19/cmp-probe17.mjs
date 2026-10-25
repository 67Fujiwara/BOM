// 直接呼んだ結果（現行 / r16 ビルド）の形ごとの違い。node cmp-probe17.mjs 106-header-probe
import fs from 'node:fs'
const n = process.argv[2]
const A = JSON.parse(fs.readFileSync(`${n}-r17b.json`)), B = JSON.parse(fs.readFileSync(`${n}.json`))
for (const b of B) {
  const a = A.find((x) => x.id === b.id) ?? {}
  const same = JSON.stringify(a.rows) === JSON.stringify(b.rows) && JSON.stringify(a.warnings) === JSON.stringify(b.warnings)
  if (process.env.ALL || !same) console.log(`\n## ${b.id} ${same ? '(同じ)' : '(違う)'} — ${b.note ?? ''}\n期待: ${b.expect ?? ''}\n r16: ${a.n} 行 ${(a.rows ?? []).slice(0, 5).join(' ‖ ')}\n      ${(a.warnings ?? []).join(' ／ ').slice(0, 300)}\n now: ${b.n} 行 ${(b.rows ?? []).slice(0, 5).join(' ‖ ')}\n      ${(b.warnings ?? []).join(' ／ ').slice(0, 300)}`)
}
