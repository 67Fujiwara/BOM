import fs from 'node:fs'
const [,, a, b, maxShow] = process.argv
const A = fs.readFileSync(a, 'utf8').split('\n').map((l) => JSON.parse(l)), B = fs.readFileSync(b, 'utf8').split('\n').map((l) => JSON.parse(l))
let diff = 0
const shown = []
for (let i = 0; i < A.length; i++) {
  const x = A[i], y = B[i]
  const ka = JSON.stringify([x.n, x.rows, x.mapping, x.error]), kb = JSON.stringify([y.n, y.rows, y.mapping, y.error])
  const wa = JSON.stringify(x.warnings), wb = JSON.stringify(y.warnings)
  if (ka !== kb) { diff++; shown.push({ i, kind: 'rows', x, y }) } else if (wa !== wb) { shown.push({ i, kind: 'warn', x, y }) }
}
console.log(`cases ${A.length}, row/mapping diffs ${diff}, warn-only diffs ${shown.filter((s) => s.kind === 'warn').length}`)
for (const s of shown.slice(0, Number(maxShow ?? 8))) {
  console.log(`--- #${s.i} ${s.kind}\n${JSON.stringify(s.x.text).slice(0, 700)}\nHEAD n=${s.x.n} map=${s.x.mapping}\n  ${(s.x.rows ?? []).map((r) => r.replace(/\u0001/g, '|')).slice(0, 12).join('\n  ')}\n  W:${(s.x.warnings ?? []).join(' ／ ').slice(0, 300)}\nOLD n=${s.y.n} map=${s.y.mapping}\n  ${(s.y.rows ?? []).map((r) => r.replace(/\u0001/g, '|')).slice(0, 12).join('\n  ')}\n  W:${(s.y.warnings ?? []).join(' ／ ').slice(0, 300)}`)
}
