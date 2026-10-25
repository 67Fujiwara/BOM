import fs from 'node:fs'
const [, , file, ...ids] = process.argv
const A = JSON.parse(fs.readFileSync(file)); const re = new RegExp('^(' + ids.join('|') + ')')
for (const x of A.filter((x) => re.test(x.id))) console.log(`## ${x.id} — ${x.note}\n期待: ${x.expect}\n  n=${x.n} ${x.rows.slice(0, 6).join(' | ')}\n  warn: ${x.warnings.join(' ／ ').slice(0, 260)}`)
