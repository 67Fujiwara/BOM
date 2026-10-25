// 現実的な Excel CSV: 見出し＋N 行、備考に複数行（中のコンマ 0〜8）が p の割合、メーカにコンマ入りが q の割合、表題 0〜3 行。
// 失敗の率を「備考の中のコンマの数」「複数行セルの割合」「表の行数」「メーカのコンマ入り」別に集計。
import fs from 'node:fs'
import { parseTable, rng, renderCsv, norm, same } from './h21.ts'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const N = Number(process.env.N ?? 3000)
const R = rng(Number(process.env.SEED ?? 7))
const { pick, chance, int } = R
const out: any[] = []
const agg: Record<string, [number, number]> = {}
const bump = (k: string, bad: boolean) => { const a = (agg[k] ??= [0, 0]); a[0]++; if (bad) a[1]++ }
let total = 0, badN = 0
for (let i = 0; i < N; i++) {
  const nRows = pick([4, 10, 50, 300])
  const pML = pick([0.02, 0.1, 0.3, 0.6, 1])
  const commas = int(9) // 備考の複数行セルの中のコンマ
  const pMaker = pick([0, 0.2, 0.5, 1])
  const nTitle = pick([0, 0, 1, 3, 5])
  const header = ['部品名', '型式', 'メーカ', '数量', '備考']
  const rows: string[][] = [header]
  for (let r = 0; r < nRows; r++) {
    const ml = chance(pML)
    let note = ''
    if (ml) { const parts: string[] = []; for (let k = 0; k <= commas; k++) parts.push('項目' + (k + 1)); const lines = 2 + int(2); const s = parts.join(', '); const cut = Math.max(1, Math.floor(s.length / lines)); note = s.slice(0, cut) + '\n' + s.slice(cut) }
    rows.push([`部品${r + 1}`, `M-${r + 1}`, chance(pMaker) ? 'Omron, Inc.' : 'オムロン', String(1 + int(9)), note])
  }
  const titles: string[][] = []
  for (let t = 0; t < nTitle; t++) titles.push([pick(['部品表', '制御盤A 部品表 2026-10-25', '作成者 山田', 'BOM'])])
  const all = [...titles, ...rows]
  const text = renderCsv(all, D, { crlf: chance(0.4) })
  const got = parseTable(text, D)
  const ok = same(got, norm(all))
  total++; if (!ok) badN++
  const nML = rows.filter((r) => r[4].includes('\n')).length
  bump(`commas=${commas}`, !ok); bump(`title=${nTitle}`, !ok); bump(`makerComma=${pMaker}`, !ok); bump(`rows=${nRows}`, !ok); bump(`pML=${pML}`, !ok); bump(nML === 0 ? 'noML' : 'hasML', !ok)
  if (!ok && out.length < 25) out.push({ i, nRows, pML, commas, pMaker, nTitle, text: text.slice(0, 400), rowsExpect: all.length, rowsGot: got.length })
}
const rate = Object.fromEntries(Object.entries(agg).sort().map(([k, [n, b]]) => [k, `${b}/${n} (${Math.round((b / n) * 100)}%)`]))
console.log(JSON.stringify({ total, bad: badN, rate }, null, 1))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/191-table-realistic-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ total, bad: badN, rate, cases: out }, null, 1))
