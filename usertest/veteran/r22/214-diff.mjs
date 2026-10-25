import fs from 'node:fs'
const A = JSON.parse(fs.readFileSync('dl/214-raw-quote-small.json')), B = JSON.parse(fs.readFileSync('dl/214-raw-quote-small-r20b.json'))
const reg = [], imp = []
for (let i = 0; i < A.bits.length; i++) { if (A.bits[i] === '0' && B.bits[i] === '1') reg.push(i); if (A.bits[i] === '1' && B.bits[i] === '0') imp.push(i) }
console.log('total', A.bits.length, 'head ok', [...A.bits].filter((x) => x === '1').length, 'r20b ok', [...B.bits].filter((x) => x === '1').length, 'regress', reg.length, 'improve', imp.length)
const show = (a) => a.slice(0, 6).forEach((i) => console.log(JSON.stringify(A.texts[i].split('\n').slice(1, 4).map((l) => l.replace(/部品\d,|,\d,/g, (m) => m[0] === ',' ? ',' : '').slice(0)))))
// 最小例: " と 3/4" の数が少ない順
const w = (i) => (A.texts[i].match(/"/g) || []).length
reg.sort((x, y) => w(x) - w(y))
console.log('--- 回帰（現行で行数が合わず r20 では合う）の少ない引用符のもの')
for (const i of reg.slice(0, 8)) console.log(JSON.stringify(A.texts[i]))
imp.sort((x, y) => w(x) - w(y))
console.log('--- 改善の例')
for (const i of imp.slice(0, 4)) console.log(JSON.stringify(A.texts[i]))
