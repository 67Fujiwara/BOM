// 表題の行にコンマがある（作成,山田 / 日付,2026-10-25 / 客先,X）Excel CSV で、データの行がほぼ全部引用符つき（コンマ入りメーカ＋複数行の備考）。
// width（引用符の無い行のコンマ数の最頻値）が表題の行で決まってしまうか。
import fs from 'node:fs'
import { parseTable, rng, renderCsv, norm, same } from './h22.ts'
const N = Number(process.env.N ?? 2000)
const { pick, chance, int } = rng(Number(process.env.SEED ?? 5))
let total = 0, bad = 0
const agg: Record<string, [number, number]> = {}
const bump = (k: string, b: boolean) => { const a = (agg[k] ??= [0, 0]); a[0]++; if (b) a[1]++ }
const out: any[] = []
for (let i = 0; i < N; i++) {
  const nTitle = pick([1, 3, 6, 10])
  const titleCommas = pick([1, 2, 3])
  const nRows = pick([3, 10, 50])
  const mlCommas = int(8)
  const hdr = ['部品名', '型式', 'メーカ', '数量', '備考']
  const titles: string[][] = Array.from({ length: nTitle }, (_, t) => Array.from({ length: titleCommas + 1 }, (_, c) => `表題${t}-${c}`))
  const rows: string[][] = [hdr, ...Array.from({ length: nRows }, (_, r) => [`部品${r}`, `M-${r}`, 'Omron, Inc.', String(r), Array.from({ length: mlCommas + 1 }, (_, k) => '項目' + k).join(', ').replace(/(.{6})/, '$1\n')])]
  // 表題の行は 1 セルだけの行ではなく、titleCommas+1 個のセル（Excel は列の数だけコンマを出す。末尾の空は出す）
  const all = [...titles, ...rows]
  const text = renderCsv(all, ',')
  const got = parseTable(text, ',')
  const ok = same(got, norm(all))
  total++; if (!ok) bad++
  bump(`titleCommas=${titleCommas}`, !ok); bump(`nTitle=${nTitle}`, !ok); bump(`mlCommas=${mlCommas}`, !ok)
  if (!ok && out.length < 8) out.push({ nTitle, titleCommas, nRows, mlCommas, exp: all.length, got: got.length, text: text.slice(0, 300) })
}
console.log(JSON.stringify({ total, bad, rate: Object.fromEntries(Object.entries(agg).sort().map(([k, [n, b]]) => [k, `${b}/${n}`])) }))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/206-table-titles-commas${process.env.TAG ?? ''}.json`, JSON.stringify({ total, bad, agg, out }, null, 1))
