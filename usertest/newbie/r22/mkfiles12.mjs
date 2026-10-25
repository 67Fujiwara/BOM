// ラウンド12: 旧・新が 2 項目とも（現/新）、2 段の見出し（結合セル）、現行/変更、ページ番号の書き方、合計の追加、複数シート、CSV
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
import iconv from 'node:util'
const D = '/home/user/BOM/usertest/newbie/r22/files12/'
fs.mkdirSync(D, { recursive: true })
const head = ['No', '品名', '型式', 'メーカー', '数量']
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// h1: 型式も数量も「現／新」（重複が 2 項目）
const pairs = [
  ['現型式', '新型式', '現数量', '新数量'],
  ['型式（現行）', '型式（変更後）', '数量（現行）', '数量（変更後）'],
  ['型式 現', '型式 新', '数量 現', '数量 新'],
  ['現行型式', '変更型式', '現行数量', '変更数量'],
  ['型式(現)', '型式(改)', '員数(現)', '員数(改)'],
  ['型式 改訂前', '型式 改訂後', '数量 改訂前', '数量 改訂後'],
  ['Model (Current)', 'Model (New)', 'Qty (Current)', 'Qty (New)'],
]
for (const [i, [a, b, c, d]] of pairs.entries()) await book(`h1_${i + 1}_dual.xlsx`, (ws) => { ws.addRow(['品名', a, b, 'メーカー', c, d]); ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow(['タイマ', 'H3Y-2', 'H3CR-A8', 'オムロン', 1, 3]) })
// h2: 2 段の見出し（型式・数量の下に 旧／新。上の段は結合セル）
await book('h2_twotier.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', '', 'メーカー', '数量', '']); ws.addRow(['', '', '旧', '新', '', '旧', '新'])
  ws.mergeCells('C1:D1'); ws.mergeCells('F1:G1'); ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('E1:E2')
  ws.addRow([1, 'リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow([2, 'タイマ', 'H3Y-2', 'H3CR-A8', 'オムロン', 1, 3])
})
// h3: 2 段の見出し（変更前／変更後）
await book('h3_twotier_before_after.xlsx', (ws) => {
  ws.addRow(['品名', 'メーカー', '型式', '', '数量', '']); ws.addRow(['', '', '変更前', '変更後', '変更前', '変更後'])
  ws.mergeCells('C1:D1'); ws.mergeCells('E1:F1')
  ws.addRow(['リレー', 'オムロン', 'MY2N', 'MY4N-D2', 2, 4])
})
// h4: ページ番号・表題の書き方（品名の列・No の列）
await book('h4_pagemarks.xlsx', (ws) => {
  let n = 1
  const marks = [['', '- 1 -'], ['', 'Page 1 of 2'], ['1/2', ''], ['', '（次頁へ続く）'], ['', '1 / 2'], ['', '次ページへ']]
  ws.addRow(head)
  for (const m of marks) { ws.addRow([n, `部品${n}`, `M-${n}`, 'オムロン', n]); n++; ws.addRow([m[0], m[1], '', '', '']) }
})
// h5: 合計の書き方の追加
await book('h5_totals.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', '金額'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, 8000])
  ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, 4000])
  for (const t of ['小 計', 'Sub Total', 'TOTAL:', '合計（税抜）', '総合計金額', '合計点数 6点', '以上、2点', 'Grand Total', '計　6', '（合計）', '合　計']) ws.addRow(['', t, '', '', 6, 12000])
})
// h6: 部品のシートが 2 枚（盤A・盤B）＋表紙
{
  const wb = new ExcelJS.Workbook()
  const c = wb.addWorksheet('表紙'); c.addRow(['制御盤 部品表']); c.addRow(['作成', '新人'])
  const a = wb.addWorksheet('盤A'); a.addRow(head); a.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4])
  const b = wb.addWorksheet('盤B'); b.addRow(head); b.addRow([1, 'ブレーカ', 'NF32-SV', '三菱電機', 2]); b.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 3])
  await wb.xlsx.writeFile(D + 'h6_two_bom_sheets.xlsx')
}
// h7: CSV UTF-16LE（BOM あり、タブ区切り＝Excel の Unicode テキスト）で旧新の 2 項目
{
  const t = '品名\t現型式\t新型式\tメーカー\t現数量\t新数量\r\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4\r\n'
  fs.writeFileSync(D + 'h7_utf16_dual.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, 'utf16le')]))
  fs.writeFileSync(D + 'h7b_utf8bom_dual.csv', '﻿品名,現型式,新型式,メーカー,現数量,新数量\r\nリレー,MY2N,MY4N-D2,オムロン,2,4\r\n')
}
// h8: 見出しの言葉がある部品の行（品名「数量計」は無いが、型式・メーカ・数量を見出し語として書いた注記行）
await book('h8_note_row.xlsx', (ws) => { ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['', '※品名・型式・メーカーは客先指定', '', '', '']); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]) })
// h9: 隠した「新」の列（新の型式を隠して旧が見えている）
await book('h9_hidden_new.xlsx', (ws) => { ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量']); ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4]); ws.getColumn(3).hidden = true })
console.log('ok')
