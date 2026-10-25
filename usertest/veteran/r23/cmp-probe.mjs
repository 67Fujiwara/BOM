// a vs b json (probe outputs): list shapes whose rows/warnings/mapping differ
import fs from 'node:fs'
const [, , n, a = '', b = '-r20b'] = process.argv
const A = JSON.parse(fs.readFileSync(`${n}-header-probe${a}.json`)), B = JSON.parse(fs.readFileSync(`${n}-header-probe${b}.json`))
const bm = new Map(B.map((x) => [x.id, x]))
let diff = 0
for (const x of A) {
  const y = bm.get(x.id); if (!y) { console.log('only in A', x.id); continue }
  const kx = JSON.stringify([x.n, x.mapping, x.rows, x.warnings]), ky = JSON.stringify([y.n, y.mapping, y.rows, y.warnings])
  if (kx !== ky) { diff++; console.log(`\n### ${x.id} — ${x.note}\n期待: ${x.expect}\n  A n=${x.n} ${x.rows.slice(0, 8).join(' | ')}\n   warn: ${x.warnings.join(' ／ ').slice(0, 300)}\n  B n=${y.n} ${y.rows.slice(0, 8).join(' | ')}\n   warn: ${y.warnings.join(' ／ ').slice(0, 300)}`) }
}
console.log(`\n${n}: ${A.length} shapes, ${diff} differ`)
