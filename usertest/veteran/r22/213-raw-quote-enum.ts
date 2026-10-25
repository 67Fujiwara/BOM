// 囲まない「"」（〃の代わり）とインチの組み合わせ。1 つの列に〃の「"」、もう 1 つの列にインチ（現実的な配置）を乱数で。
// 行数が合うかを現行 / r20 ビルドで比べる。結果は 0/1 の列にして保存し、2 ビルドで突き合わせる（213-diff.mjs）。
import fs from 'node:fs'
import { parseTable, rng } from './h22.ts'
const N = Number(process.env.N ?? 20000)
const { pick, chance, int } = rng(Number(process.env.SEED ?? 3))
const bits: string[] = []
const texts: string[] = []
const meta: any[] = []
for (let i = 0; i < N; i++) {
  const nRows = 2 + int(8)
  const dCol = pick(['name', 'model', 'maker', 'note'])
  const iCol = pick(['name', 'model', 'none'])
  const pD = pick([0.3, 0.6, 1]), pI = pick([0.3, 1])
  const qMaker = chance(0.4), ml = chance(0.4), mlCommas = int(7)
  const rows: string[] = ['部品名,型式,メーカ,数量,備考']
  for (let r = 0; r < nRows; r++) {
    const c: Record<string, string> = { name: `部品${r}`, model: `M-${r}`, maker: qMaker && chance(0.5) ? '"Omron, Inc."' : 'オムロン', note: '' }
    if (ml && chance(0.3)) c.note = '"' + Array.from({ length: mlCommas + 1 }, (_, k) => '項目' + k).join(', ') + '\n続き"'
    if (r > 0 && chance(pD)) c[dCol] = '"'
    if (iCol !== 'none' && chance(pI) && c[iCol] !== '"') c[iCol] = iCol === 'name' ? `パイプ 1/2" 長尺` : '3/4"'
    rows.push([c.name, c.model, c.maker, String(r), c.note].join(','))
  }
  const text = rows.join('\n') + '\n'
  bits.push(parseTable(text, ',').length === nRows + 1 ? '1' : '0')
  texts.push(text); meta.push({ nRows, dCol, iCol, pD, pI, qMaker, ml, mlCommas })
}
console.log(JSON.stringify({ N, ok: bits.filter((b) => b === '1').length }))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/dl/213-raw-quote-enum${process.env.TAG ?? ''}.json`, JSON.stringify({ bits: bits.join(''), meta, texts }))
