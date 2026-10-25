// ラウンド21: 再実行の結果（.log の JSON 行）を、ラウンド20 の結果（usertest/veteran/r20）と突き合わせる
import fs from 'node:fs'
const A0 = '/home/user/BOM/usertest/veteran/r20', B0 = '/home/user/BOM/usertest/veteran/r22'
let names = process.argv.slice(2)
if (!names.length) names = fs.readdirSync(B0).filter((f) => f.endsWith('.log') && fs.existsSync(`${A0}/${f}`) && !/^(dev|prev|batch|sweep)/.test(f))
const norm = (s) => s.replace(/"ms":\d+/g, '"ms":0').replace(/\d+(\.\d+)?ms/g, 'Nms').replace(/"(t|dt|elapsed|loadMs|createMs|med|p50|p90|mean|avg)":\d+(\.\d+)?/g, '"$1":0').replace(/\d{2}:\d{2}:\d{2}/g, 'T').replace(/P-[A-Z]+\d+/g, 'P-X').replace(/20\d\d-\d\d-\d\dT[\d:.]+Z/g, 'TS')
const out = {}
for (const pair of names.sort()) {
  const [n, m = n] = pair.split('=')
  if (!fs.existsSync(`${B0}/${n}`) || !fs.existsSync(`${A0}/${m}`)) { console.log('missing', n, m); continue }
  const a = fs.readFileSync(`${A0}/${m}`, 'utf8'), b = fs.readFileSync(`${B0}/${n}`, 'utf8')
  const A = a.split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).map(norm), B = b.split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).map(norm)
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) diffs.push({ i, r20: (A[i] ?? '').slice(0, 500), r21: (B[i] ?? '').slice(0, 500) })
  out[n] = { lines: [A.length, B.length], diffs: diffs.length, first: diffs.slice(0, 6) }
  console.log(n.padEnd(44), A.length, B.length, 'diffs', diffs.length)
}
fs.writeFileSync(`${B0}/210-diff-r20${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 2))
