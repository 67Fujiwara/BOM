// ラウンド11: 見出しの繰り返し（少し違う）、合計の書き方の残り、旧・新の見出しの残り、飾りのセル、隠した数量の列
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r12/files11/'
fs.mkdirSync(D, { recursive: true })
const head = ['No', '品名', '型式', 'メーカー', '数量']
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// g1: 2 ページ目の見出しで No のセルだけ空（見出しの行をコピーし損ねた）
await book('g1_header_noNo.xlsx', (ws) => { ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]); ws.addRow([]); ws.addRow(['', '品名', '型式', 'メーカー', '数量']); ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', 1]) })
// g2: 2 ページ目の見出しに「（続き）」
await book('g2_header_cont.xlsx', (ws) => { ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]); ws.addRow(['No', '品名（続き）', '型式', 'メーカー', '数量']); ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', 1]) })
// g3: 3 ページ。ページの下に「- 1 -」、上に表題（ページ番号つき）
await book('g3_three_pages.xlsx', (ws) => {
  let n = 1
  for (let pg = 1; pg <= 3; pg++) { ws.addRow([`制御盤B 部品表 (${pg}/3)`]); ws.addRow(head); for (let i = 0; i < 3; i++) { ws.addRow([n, `部品${n}`, `M-${n}`, 'オムロン', n]); n++ } ws.addRow([`- ${pg} -`]) }
})
// g4: 合計の書き方の残り
await book('g4_totals5.xlsx', (ws) => {
  ws.addRow(['No', '品名', '形式', 'メーカー', '員数', '備考'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, ''])
  ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, ''])
  for (const t of ['総数量', '員数合計', '数量計', '合計 6 個 ¥12,000', 'Total Qty', '合 計 点 数', '以下余白です', '計 2点', '合計数']) ws.addRow(['', t, '', '', 6, ''])
  ws.addRow(['', '', '', '', 6, '合計'])
})
// g5: 旧・新の見出しの残り
const oldnew = [['型式 旧', '型式 新'], ['型式_旧', '型式_新'], ['型式【旧】', '型式【新】'], ['型式[旧]', '型式[新]'], ['変更前型式', '変更後型式'], ['型式(before)', '型式(after)'], ['現型式', '新型式'], ['型式（旧品）', '型式（新品）']]
for (const [i, [o, nw]] of oldnew.entries()) await book(`g5_${i + 1}_oldnew.xlsx`, (ws) => { ws.addRow(['品名', o, nw, 'メーカー', '数量']); ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4]) })
// g6: 新人が空のつもりで「－」「---」「なし」を入れた
await book('g6_dash_cells.xlsx', (ws) => { ws.addRow(['品名', '型式', 'メーカー', '数量', '備考']); ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4, '---']); ws.addRow(['端子台', 'TB-10', '－－－', 10, '']); ws.addRow(['ダクト', '---', '---', 2, '現場合わせ']); ws.addRow(['ラベル', '－', '－', '－', '']) })
// g7: 数量の列だけを隠した（ほかに数量の列は無い）＋ 旧型式の列を隠した
await book('g7_hidden_qty.xlsx', (ws) => { ws.addRow(['品名', '旧型式', '型式', 'メーカー', '数量']); ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['タイマ', 'H3Y', 'H3CR-A8', 'オムロン', 2]); ws.getColumn(2).hidden = true; ws.getColumn(5).hidden = true })
// g8: 数量（旧）・数量（新）と型式（旧）・型式（新）が混ざり、新の列が左
await book('g8_new_left.xlsx', (ws) => { ws.addRow(['品名', '型式（新）', '型式（旧）', 'メーカー', '数量（新）', '数量（旧）']); ws.addRow(['リレー', 'MY4N-D2', 'MY2N', 'オムロン', 4, 2]) })
// g9: 2 つ目の表（予備品）に表題の行
await book('g9_spare_table.xlsx', (ws) => { ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([]); ws.addRow(['【予備品】']); ws.addRow(head); ws.addRow([1, 'ヒューズ', 'F-1', 'X社', 10]) })
console.log('ok')
