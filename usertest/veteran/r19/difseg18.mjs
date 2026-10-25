// r17 と r18（日付は D にそろえる。DATE=0 で日付もそのまま） の同じ名前の .log の JSON 行を比べ、違う箇所の前後だけを出す。node difseg.mjs name.log [幅]
import fs from 'node:fs'
const n = process.argv[2]; const w = Number(process.argv[3] ?? 220)
const norm = (s) => s.replace(/"ms":\d+/g, '"ms":0').replace(/\d+(\.\d+)?ms/g, 'Nms').replace(/"(t|dt|elapsed|loadMs|createMs|med|p50|p90|mean|avg)":\d+(\.\d+)?/g, '"$1":0').replace(/\d{2}:\d{2}:\d{2}/g, 'T').replace(/P-[A-Z]+\d+/g, 'P-X').replace(/20\d\d-\d\d-\d\dT[\d:.]+Z/g, 'TS')
const normD = (s) => (process.env.DATE === '0' ? s : s.replace(/20\d\d[-/]\d\d[-/]\d\d/g, 'D').replace(/\b\d{1,2}\/\d{1,2}\b/g, 'D').replace(/あと-?\d+日/g, 'あとN日').replace(/-?\d+日(超過|前|後)/g, 'N日$1').replace(/\(-?\d+(\.\d+)?%\)/g, '(P%)'))
const rd = (d) => fs.readFileSync(`/home/user/BOM/usertest/veteran/${d}/${n}`, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => normD(norm(l)))
const A = rd('r17'), B = rd('r18')
for (let k = 0; k < Math.max(A.length, B.length); k++) {
  const a = A[k] ?? '', b = B[k] ?? ''; if (a === b) continue
  let i = 0; while (i < a.length && a[i] === b[i]) i++
  let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++
  console.log(`[${k}] ${(a.match(/"(name|case)":"([^"]{0,60})/) ?? [])[2] ?? ''}\n  r17: …${a.slice(Math.max(0, i - 80), Math.min(a.length - j + 40, i + w))}\n  r18: …${b.slice(Math.max(0, i - 80), Math.min(b.length - j + 40, i + w))}`)
}
