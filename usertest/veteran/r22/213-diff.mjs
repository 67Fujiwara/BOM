import fs from 'node:fs'
const A = JSON.parse(fs.readFileSync('dl/213-raw-quote-enum.json')), B = JSON.parse(fs.readFileSync('dl/213-raw-quote-enum-r20b.json'))
const reg = [], imp = []
const agg = {}
for (let i = 0; i < A.bits.length; i++) {
  const m = A.meta[i]
  const k = `ditto=${m.dCol} inch=${m.iCol}`
  const a = (agg[k] ??= { n: 0, headBad: 0, oldBad: 0, reg: 0, imp: 0 })
  a.n++
  if (A.bits[i] === '0') a.headBad++
  if (B.bits[i] === '0') a.oldBad++
  if (A.bits[i] === '0' && B.bits[i] === '1') { reg.push(i); a.reg++ }
  if (A.bits[i] === '1' && B.bits[i] === '0') { imp.push(i); a.imp++ }
}
console.log('total', A.bits.length, 'head ok', [...A.bits].filter((x) => x === '1').length, 'r20b ok', [...B.bits].filter((x) => x === '1').length, 'regress', reg.length, 'improve', imp.length)
for (const [k, v] of Object.entries(agg).sort()) console.log(k.padEnd(28), JSON.stringify(v))
reg.sort((x, y) => A.texts[x].length - A.texts[y].length)
for (const i of reg.slice(0, 4)) console.log('REG', JSON.stringify(A.texts[i]), JSON.stringify(A.meta[i]))
