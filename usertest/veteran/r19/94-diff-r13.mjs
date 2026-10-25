// ラウンド14: r12・r11 の手順の再実行の結果（.log）を、ラウンド13 の結果（usertest/veteran/r13）と突き合わせる（差分の件数と最初の数件）
import fs from 'node:fs'
const R12 = "/home/user/BOM/usertest/veteran/r13", R13 = "/home/user/BOM/usertest/veteran/r19"
const names = process.argv.slice(2)
const norm = (s) => s.replace(/"ms":\d+/g, '"ms":0').replace(/\d+ms/g, 'Nms').replace(/"(t|dt|elapsed|loadMs|createMs)":\d+(\.\d+)?/g, '"$1":0').replace(/\d{2}:\d{2}:\d{2}/g, 'T').replace(/P-[A-Z]+\d+/g, "P-X")
const out = {}
for (const n of names) {
  const a = fs.existsSync(`${R12}/${n}`) ? fs.readFileSync(`${R12}/${n}`, 'utf8') : null
  const b = fs.existsSync(`${R13}/${n}`) ? fs.readFileSync(`${R13}/${n}`, 'utf8') : null
  if (!a || !b) { out[n] = { missing: !a ? 'r12' : 'r13' }; continue }
  const A = a.split('\n').filter((l) => l.startsWith('{')).map(norm), B = b.split('\n').filter((l) => l.startsWith('{')).map(norm)
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) diffs.push({ i, r12: (A[i] ?? '').slice(0, 400), r13: (B[i] ?? '').slice(0, 400) })
  out[n] = { lines: [A.length, B.length], diffs: diffs.length, first: diffs.slice(0, 4) }
  console.log(n, A.length, B.length, 'diffs', diffs.length)
}
fs.writeFileSync(`${R13}/94-diff-r13.json`, JSON.stringify(out, null, 2))
