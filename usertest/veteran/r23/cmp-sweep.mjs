// r21 と r22 の画面試験のログを、時間・ms を除いて突き合わせる
import fs from 'node:fs'
const names = fs.readFileSync('/home/user/BOM/usertest/veteran/r23/sweep.status', 'utf8').split('\n').filter((l) => l.startsWith('== ')).map((l) => l.split(' ')[1])
const norm = (s) => s.replace(/"(ms|t|time|ms2x|wallMs|cpuMs|elapsed|at)":\s*-?[\d.]+/g, '"$1":0').replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, 'T').replace(/\d+(\.\d+)?\s*ms/g, 'Nms').replace(/R\d{3}-\d+/g, 'Rn').replace(/\d{13}/g, 'TS').replace(/\s+/g, ' ')
let same = 0, diff = 0, missing = 0
for (const n of names) {
  const a = '/home/user/BOM/usertest/veteran/r21/' + n + '.log', b = '/home/user/BOM/usertest/veteran/r23/' + n + '.log'
  if (!fs.existsSync(a) || !fs.existsSync(b)) { missing++; console.log('MISSING', n, fs.existsSync(a), fs.existsSync(b)); continue }
  const A = norm(fs.readFileSync(a, 'utf8')), B = norm(fs.readFileSync(b, 'utf8'))
  if (A === B) { same++; continue }
  diff++
  const la = A.split(/(?<=\})\s(?=\{)/), lb = B.split(/(?<=\})\s(?=\{)/)
  console.log('DIFF', n, 'len', A.length, B.length)
}
console.log({ same, diff, missing })
