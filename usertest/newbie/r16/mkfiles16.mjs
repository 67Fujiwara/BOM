// ラウンド16: 新人の手元の BOM その 4（ラウンド15 の直しの周り: 変えた行は新の列を全部書く変更図・備考の「※削除」・号機の列に合計なし・数だけのセルの表題欄・縦横の結合のデータ・「"」と 1/2" のセル）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r16/files16/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// c1: 設計変更の様式（上の段「変更前｜変更後」を結合）。変えた行（リレー）は変更後の型式・数量を両方書き、変えない行は変更後を空に
await book('c1_change_form_fill.xlsx', (ws) => {
  ws.addRow(['', '変更前', '', '変更後', ''])
  ws.addRow(['品名', '型式', '数量', '型式', '数量'])
  ws.mergeCells('B1:C1'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY2N', 2, 'MY4N-D2', 2]); ws.addRow(['タイマ', 'H3CR-A8', 1, '', '']); ws.addRow(['ブレーカ', 'NF32-SV', 1, '', '']); ws.addRow(['端子台', 'XW2B-20G4', 4, '', ''])
})
// c2: 型式（旧）｜型式（新）｜メーカー（旧）｜メーカー（新）。変えた行はメーカーも写す
await book('c2_change_maker_copy.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー（旧）', 'メーカー（新）', '数量'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 'オムロン', 4]); ws.addRow(['タイマ', 'H3CR-A8', '', 'オムロン', '', 1]); ws.addRow(['ブレーカ', 'NF32-SV', '', '三菱電機', '', 1])
})
// c3: 旧／新の変更図で、削除は備考に「※削除」「今回削除」「（削除）」
await book('c3_note_delete.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, '']); ws.addRow(['タイマ', 'H3Y-2', '', 'オムロン', 1, '※削除'])
  ws.addRow(['ランプ', 'L-1', '', 'IDEC', 1, '今回削除']); ws.addRow(['ソケット', 'PYF14A', '', 'オムロン', 2, '（削除）'])
})
// c4: 2 段の見出しで数量の下に「1号機｜2号機」（合計の列なし）
await book('c4_gouki_no_total.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', ''])
  ws.addRow(['', '', '', '1号機', '2号機'])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1])
})
// c5: 数量の下に「1台当り｜台数｜合計」
await book('c5_per_unit_sets.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '', ''])
  ws.addRow(['', '', '', '1台当り', '台数', '合計'])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:F1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 3, { formula: 'D3*E3', result: 6 }]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 3, { formula: 'D4*E4', result: 3 }])
})
// c6: 表題欄（品名｜制御盤A｜図番｜D-1234｜数量｜1｜備考｜試作）の下に 3 列の見出し
await book('c6_title_number.xlsx', (ws) => {
  ws.addRow(['品名', '制御盤A', '図番', 'D-1234', '数量', 1, '備考', '試作'])
  ws.addRow([])
  ws.addRow(['品名', '型式', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 4]); ws.addRow(['タイマ', 'H3CR-A8', 2])
})
// c7: メーカーと備考を 2 列 × 3 行で結合（同じメーカー・同じ備考をまとめた）
await book('c7_merge_maker_note.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '備考', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン 制御部', '', 4]); ws.addRow(['タイマ', 'H3CR-A8', '', '', 2]); ws.addRow(['ソケット', 'PYF14A', '', '', 4])
  ws.addRow(['ブレーカ', 'NF32-SV', '三菱電機', '', 1])
  ws.mergeCells('C2:D4')
})
// c8: 「"」だけのセル（〃の代わり）と 1/2" の配管部品
await book('c8_inch_quote.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量'])
  ws.addRow(['ニップル', 'SGP 1/2"', 'ベンカン', 4]); ws.addRow(['ソケット', 'SGP 1/2"', '"', 2]); ws.addRow(['エルボ', 'SGP 3/4"', '"', 2]); ws.addRow(['ユニオン', 'SGP 1"', 'ベンカン', 1])
})
// c9: 号機を横に並べた 1 段の見出し（A号機｜B号機｜合計）
await book('c9_gouki_ab.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', 'A号機', 'B号機', '合計'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 4]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 2])
})
console.log('ok')
