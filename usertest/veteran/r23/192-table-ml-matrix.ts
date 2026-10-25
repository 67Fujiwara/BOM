// 複数行セルの 1 個を、いろいろな位置・周りで Excel 風に書き出して parseTable に通す。失敗する組み合わせの表。
import fs from 'node:fs'
import { parseTable, norm, same, renderCsv } from './h22.ts'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const MLS: Record<string, string> = {
  plain2: '1行目\n2行目', commas1: '1行目, a\n2行目', commas3: 'a, b, c,\nd', commas5: 'R1, R2, R3,\nR4, R5, R6', commas9: 'a, b, c, d, e,\nf, g, h, i, j',
  quoteIn: '"引用"\n続き', crlf: 'a\r\nb', blankLine: 'x\n\ny', trailNL: '末尾改行\n', leadNL: '\n先頭改行', onlyNL: '\n', lines4: 'a\nb\nc\nd', lines12: Array.from({ length: 12 }, (_, i) => '行' + i).join('\n'),
  inchML: 'パイプ 3/4"\n長さ 2m', dittoML: '"\n"', tabIn: 'a\tb\nc', long: 'x'.repeat(300) + '\n' + 'y'.repeat(300), jp: '配線は、盤内で\nまとめる、こと', colonList: '色: 赤, 青\n形: 丸',
}
const ctx = {
  col: [0, 2, 4], // 列
  rows: [3, 30],
  commaCell: ['none', 'sameRowBefore', 'sameRowAfter', 'otherRows', 'allRows'],
  quoteAll: [false, true],
  title: [0, 3],
}
const res: any[] = []
const byMl: Record<string, [number, number]> = {}
const byCtx: Record<string, [number, number]> = {}
for (const [name, ml] of Object.entries(MLS)) for (const col of ctx.col) for (const nRows of ctx.rows) for (const cc of ctx.commaCell) for (const qa of ctx.quoteAll) for (const nt of ctx.title) {
  const hdr = ['部品名', '型式', 'メーカ', '数量', '備考']
  const rows: string[][] = [hdr]
  const mlRow = Math.floor(nRows / 2) + 1
  for (let r = 1; r <= nRows; r++) {
    const row = [`部品${r}`, `M-${r}`, 'オムロン', String(r), '']
    if (cc === 'allRows') row[2] = 'Omron, Inc.'
    if (cc === 'otherRows' && r !== mlRow) row[2] = 'Omron, Inc.'
    if (r === mlRow) {
      row[col] = ml
      if (cc === 'sameRowBefore') row[col === 0 ? 1 : 0] = 'A, B'
      if (cc === 'sameRowAfter') row[col === 4 ? 3 : 4] = 'A, B'
    }
    rows.push(row)
  }
  const all = [...Array.from({ length: nt }, () => ['部品表 制御盤A']), ...rows]
  const text = renderCsv(all, D, { quoteAll: qa })
  const got = parseTable(text, D)
  const ok = same(got, norm(all))
  const k1 = name; const k2 = `col${col} rows${nRows} comma=${cc} qa=${qa} title=${nt}`
  ;(byMl[k1] ??= [0, 0])[0]++; if (!ok) byMl[k1][1]++
  ;(byCtx[k2] ??= [0, 0])[0]++; if (!ok) byCtx[k2][1]++
  if (!ok && res.length < 30 && process.env.SHOW) res.push({ name, k2, text: text.slice(0, 300), exp: all.length, got: got.length })
}
const f = (o: Record<string, [number, number]>) => Object.entries(o).filter(([, [, b]]) => b > 0).map(([k, [n, b]]) => `${k}: ${b}/${n}`)
const sum = { byMl: f(byMl), byCtxFail: f(byCtx).length, byCtxTotal: Object.keys(byCtx).length, byCtx: f(byCtx) }
console.log(JSON.stringify({ byMl: sum.byMl, ctxFail: `${sum.byCtxFail}/${sum.byCtxTotal}` }, null, 1))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/192-table-ml-matrix-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ ...sum, res }, null, 1))
