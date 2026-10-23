// 2 つの probe の結果（現行 / r14 ビルド）を並べる。node cmp-probe.mjs a.json b.json
import fs from 'node:fs'
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
for (const x of a) {
  const y = b.find((z) => z.id === x.id) ?? {}
  const same = JSON.stringify(x.rows) === JSON.stringify(y.rows)
  console.log(`\n## ${x.id} ${same ? '(同じ)' : '(違う)'} — ${x.note ?? ''}\n期待: ${x.expect ?? ''}`)
  console.log('HEAD: ' + x.rows.join(' ‖ ') + '\n  知らせ: ' + (x.warnings ?? []).join(' ／ '))
  if (!same) console.log('r14 : ' + (y.rows ?? []).join(' ‖ ') + '\n  知らせ: ' + (y.warnings ?? []).join(' ／ '))
}
