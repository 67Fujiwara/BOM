import fs from 'node:fs'
const [,, a, b, filter] = process.argv
const A = JSON.parse(fs.readFileSync(a)), B = b && b !== '-' ? JSON.parse(fs.readFileSync(b)) : []
const mb = new Map(B.map((x) => [x.id, x]))
for (const x of A) {
  if (filter && !new RegExp(filter).test(x.id)) continue
  const y = mb.get(x.id)
  const same = y && JSON.stringify([x.n, x.rows, x.warnings]) === JSON.stringify([y.n, y.rows, y.warnings])
  console.log(`## ${x.id} ${same ? '(=old)' : y ? '(DIFF vs old)' : ''}\n  期待: ${x.expect}\n  n=${x.n} | ${x.rows.map((r) => r.split(' / ').slice(0, 4).filter(Boolean).join('/') + (r.split(' / ')[7] ? '{' + r.split(' / ')[7] + '}' : '')).join(' ; ').slice(0, 600)}\n  W: ${x.warnings.join(' ／ ').slice(0, 400)}`)
  if (y && !same) console.log(`  OLD n=${y.n} | ${y.rows.map((r) => r.split(' / ').slice(0, 4).filter(Boolean).join('/')).join(' ; ').slice(0, 400)}\n  OLD W: ${y.warnings.join(' ／ ').slice(0, 300)}`)
}
