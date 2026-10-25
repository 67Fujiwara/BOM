// 305 の失敗の最小例を探す：2〜4 列・2〜4 行の RFC CSV で複数行セルのコンマの数と行数を変えて
import { parseTable, rng } from './h22.ts'
const { pick, chance, int } = rng(5)
let best: any[] = []
const D = ','
for (let t = 0; t < 200000; t++) {
  const nc = 2 + int(4), nr = 2 + int(3)
  const truth: string[][] = [], texts: string[] = []
  for (let r = 0; r < nr; r++) {
    const tr: string[] = [], rw: string[] = []
    for (let c = 0; c < nc; c++) {
      const ml = r > 0 && chance(0.35)
      if (!ml) { tr.push(`v${r}${c}`); rw.push(`v${r}${c}`); continue }
      const lines = 2 + int(2)
      const parts = Array.from({ length: lines }, (_, i) => Array.from({ length: 1 + int(4) }, (_, k) => `w${i}${k}`).join(', '))
      tr.push(parts.join(' ')); rw.push('"' + parts.join('\n') + '"')
    }
    truth.push(tr); texts.push(rw.join(D))
  }
  const text = texts.join('\n') + '\n'
  const got = parseTable(text, D)
  if (JSON.stringify(got) !== JSON.stringify(truth)) { best.push(text); if (best.length > 3000) break }
}
best.sort((a, b) => a.length - b.length)
console.log('bad found', best.length)
for (const b of best.slice(0, 6)) console.log(JSON.stringify(b))
