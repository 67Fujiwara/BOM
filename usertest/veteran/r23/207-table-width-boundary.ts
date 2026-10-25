// 207: 引用符の無い行が少ない小さな Excel CSV で、表題の行（コンマ 1 つ「作成,山田」）の数と、引用符の無い部品の行の数の境目。
// 部品の行は U 行が引用符なし、Q 行がコンマ入りメーカ（"Omron, Inc."）で、そのうち M 行の備考が複数行（コンマ 3 つ）。
import { parseTable, renderCsv, norm, same } from './h22.ts'
const hdr = ['部品名', '型式', 'メーカ', '数量', '備考']
const lines: string[] = ['nTitle \\ U(引用符なしの部品行)   0   1   2   3   5   8   12']
for (const nTitle of [0, 1, 2, 3, 4, 6, 10]) {
  let line = String(nTitle).padStart(6) + '                      '
  for (const U of [0, 1, 2, 3, 5, 8, 12]) {
    const titles = Array.from({ length: nTitle }, (_, t) => [`表題${t}`, `値${t}`])
    const rows: string[][] = [hdr]
    for (let r = 0; r < U; r++) rows.push([`部品${r}`, `M-${r}`, 'オムロン', String(r), ''])
    for (let r = 0; r < 4; r++) rows.push([`Q${r}`, `M-${r}`, 'Omron, Inc.', String(r), r % 2 ? 'a, b, c, d\ne' : ''])
    const all = [...titles, ...rows]
    const ok = same(parseTable(renderCsv(all, ','), ','), norm(all))
    line += (ok ? '  ok' : '  NG')
  }
  lines.push(line)
}
console.log(lines.join('\n'))
