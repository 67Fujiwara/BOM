import fs from 'node:fs'
const [,, probe, wiz, wiz2] = process.argv
const p = JSON.parse(fs.readFileSync(probe)), w = JSON.parse(fs.readFileSync(wiz))
const pm = new Map(p.map((x) => [x.id, x]))
let bad = 0
for (const x of w) {
  const q = pm.get(x.id)
  if (!q) { console.log('noprobe', x.id); continue }
  const rows = x.created?.rows
  if (rows !== q.n) { bad++; console.log('MISMATCH', x.id, 'wizard', rows, 'probe', q.n, x.toast?.slice(0, 80)) }
}
console.log('compared', w.length, 'mismatch', bad, 'errs', w.filter((x) => x.errs?.length).map((x) => x.id + ':' + x.errs[0]).join(' | '))
