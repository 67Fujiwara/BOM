// ラウンド19: 再実行の結果（.log の JSON 行）を、ラウンド18 の結果（usertest/veteran/r18）と突き合わせる（差分の件数と最初の数件）
// node 135-diff-r17.mjs a.log b.log …（引数が無ければ両方にある .log 全部）
import fs from 'node:fs'
const A0 = '/home/user/BOM/usertest/veteran/r18', B0 = '/home/user/BOM/usertest/veteran/r19'
let names = process.argv.slice(2)
names = names.filter((f) => fs.existsSync(`${A0}/${f}`))
if (!names.length) names = fs.readdirSync(B0).filter((f) => f.endsWith('.log') && fs.existsSync(`${A0}/${f}`) && !/^(dev|prev)/.test(f))
const norm = (s) => s.replace(/"ms":\d+/g, '"ms":0').replace(/\d+(\.\d+)?ms/g, 'Nms').replace(/"(t|dt|elapsed|loadMs|createMs|med|p50|p90|mean|avg)":\d+(\.\d+)?/g, '"$1":0').replace(/\d{2}:\d{2}:\d{2}/g, 'T').replace(/P-[A-Z]+\d+/g, 'P-X').replace(/20\d\d-\d\d-\d\dT[\d:.]+Z/g, 'TS')
const out = {}
for (const n of names.sort()) {
  const a = fs.readFileSync(`${A0}/${n}`, 'utf8'), b = fs.readFileSync(`${B0}/${n}`, 'utf8')
  const A = a.split('\n').filter((l) => l.startsWith('{')).map(norm), B = b.split('\n').filter((l) => l.startsWith('{')).map(norm)
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) diffs.push({ i, r18: (A[i] ?? '').slice(0, 600), r19: (B[i] ?? '').slice(0, 600) })
  out[n] = { lines: [A.length, B.length], diffs: diffs.length, first: diffs.slice(0, 6) }
  console.log(n.padEnd(36), A.length, B.length, 'diffs', diffs.length)
}
fs.writeFileSync(`${B0}/146-diff-r18${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 2))
