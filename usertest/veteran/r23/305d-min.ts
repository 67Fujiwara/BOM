import { parseTable, rng } from './h22.ts'
const { pick, chance, int } = rng(7)
const D = ','
const found: string[] = []
for (let t = 0; t < 300000 && found.length < 4000; t++) {
  const nc = 5 + int(2), nr = 6 + int(5)
  const truth: string[][] = [], texts: string[] = []
  for (let r = 0; r < nr; r++) {
    const tr: string[] = [], rw: string[] = []
    for (let c = 0; c < nc; c++) {
      const k = r === 0 ? 'x' : chance(0.12) ? 'ml' : chance(0.3) ? 'cm' : 'x'
      if (k === 'x') { tr.push(`v${r}${c}`); rw.push(`v${r}${c}`) }
      else if (k === 'cm') { tr.push(`a, b ${r}`); rw.push(`"a, b ${r}"`) }
      else { const parts = Array.from({ length: 2 + int(2) }, (_, i) => Array.from({ length: 1 + int(3) }, (_, q) => `w${i}${q}`).join(', ')); tr.push(parts.join(' ')); rw.push('"' + parts.join('\n') + '"') }
    }
    truth.push(tr); texts.push(rw.join(D))
  }
  const text = texts.join('\n') + '\n'
  if (JSON.stringify(parseTable(text, D)) !== JSON.stringify(truth)) found.push(text)
}
found.sort((a, b) => a.length - b.length)
console.log('bad', found.length)
for (const b of found.slice(0, 5)) console.log(JSON.stringify(b))
