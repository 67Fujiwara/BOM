// ラウンド18: 新人の手元の BOM その 6（ラウンド17 の直しの周り: 数量だけ変えた行に新の型式も書く変更図・備考「削除不要」など・
// メーカ DNP（大日本印刷）・実装 有／無・1台目｜2台目・セル内改行の最後の改行・押印欄）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r21/files18/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// e1: 設計変更の様式（上の段「変更前｜変更後」を結合）。変えた行だけ変更後を書く。タイマ・ソケットは数量だけ変えたので変更後の型式も同じ値で書いた
await book('e1_change_form_qty_rows.xlsx', (ws) => {
  ws.addRow(['', '変更前', '', '変更後', '', ''])
  ws.addRow(['品名', '型式', '数量', '型式', '数量', '備考'])
  ws.mergeCells('B1:C1'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY2N', 4, 'MY4N-D2', 4, '型式変更'])
  ws.addRow(['タイマ', 'H3CR-A8', 1, 'H3CR-A8', 2, '数量変更'])
  ws.addRow(['ソケット', 'PYF14A', 2, 'PYF14A', 4, '数量変更'])
  ws.addRow(['端子台', 'XW2B-20G4', 4, '', '', ''])
  ws.addRow(['ランプ', 'L-1', 1, '', '', ''])
  ws.addRow(['ブレーカ', 'NF32-SV', 1, '', '', ''])
})
// e2: 旧／新の変更図。新の列が空の行の備考に「削除不要」「削除取消（Rev.2で復活）」「撤去不要（流用）」
await book('e2_note_keep_words.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, ''])
  ws.addRow(['タイマ', 'H3CR-A8', '', 'オムロン', 1, '削除不要'])
  ws.addRow(['ソケット', 'PYF14A', '', 'オムロン', 2, '削除取消（Rev.2で復活）'])
  ws.addRow(['ランプ', 'L-1', '', 'IDEC', 1, '撤去不要（流用）'])
  ws.addRow(['端子台', 'XW2B-20G4', '', 'オムロン', 4, ''])
})
// e3: メーカに DNP（大日本印刷）の部品
await book('e3_maker_dnp.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['反射フィルム', 'RF-200', 'DNP', 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1])
})
// e4: 実装の列に 有／無
await book('e4_jissou_umu.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '実装'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4, '有']); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, '無']); ws.addRow(['ランプ', 'L-1', 'IDEC', 1, '有'])
})
// e5: 1 段の見出し「1台目｜2台目」（数量の語なし）
await book('e5_daime.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '1台目', '2台目'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1])
})
// e6: セルの最後に Alt+Enter の改行が残った部品名・型式
await book('e6_cell_trailing_newline.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量'])
  ws.addRow(['リレー\n', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['タイマ', '\nH3CR-A8', 'オムロン', 2]); ws.addRow(['ランプ', 'L-1', 'IDEC', 1])
})
// e7: 部品の下に押印欄（承認｜検図｜作成 の行と 名前の行）
await book('e7_stamp_block.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 2])
  ws.addRow([]); ws.addRow(['承認', '検図', '作成', '']); ws.addRow(['鈴木', '佐藤', '山田', ''])
})
console.log(fs.readdirSync(D).join(' '))
