// ラウンド17: 新人の手元の BOM その 5（ラウンド16 の直しの周り: 全行を書き写した変更図で削除が多い・備考の削除に Rev や理由・
// 号機の数量を 1 段で書く・予備の列・号機のセルに文字・削除した行の下の〃・表題欄の製作台数）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r23/files17/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// d1: 設計変更の様式（上の段「変更前｜変更後」を結合）。全行の変更後を書き写し、削除する 2 行（ブレーカ・ランプ）は変更後を空に
await book('d1_change_form_copy_delete.xlsx', (ws) => {
  ws.addRow(['', '変更前', '', '変更後', ''])
  ws.addRow(['品名', '型式', '数量', '型式', '数量'])
  ws.mergeCells('B1:C1'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY2N', 2, 'MY4N-D2', 2]); ws.addRow(['タイマ', 'H3CR-A8', 1, 'H3CR-A8', 1]); ws.addRow(['ブレーカ', 'NF32-SV', 1, '', ''])
  ws.addRow(['端子台', 'XW2B-20G4', 4, 'XW2B-20G4', 4]); ws.addRow(['ランプ', 'L-1', 1, '', '']); ws.addRow(['ソケット', 'PYF14A', 2, 'PYF14A', 2])
})
// d2: 旧／新の変更図で、削除は備考に「削除（Rev.1）」「廃止（代替なし）」「削除のこと」
await book('d2_note_delete_rev.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, '']); ws.addRow(['タイマ', 'H3Y-2', '', 'オムロン', 1, '削除（Rev.1）'])
  ws.addRow(['ランプ', 'L-1', '', 'IDEC', 1, '廃止（代替なし）']); ws.addRow(['ソケット', 'PYF14A', '', 'オムロン', 2, '削除のこと'])
  ws.addRow(['端子台', 'XW2B-20G4', '', 'オムロン', 4, ''])
})
// d3: 1 段の見出しで「1号機数量｜2号機数量｜3号機数量」（合計の列なし）
await book('d3_gouki_1tier.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '1号機数量', '2号機数量', '3号機数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 1])
})
// d4: 2 段の見出し。数量の下に「1号機｜2号機｜予備」
await book('d4_gouki_yobi.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '', ''])
  ws.addRow(['', '', '', '1号機', '2号機', '予備'])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:F1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 1]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 0])
})
// d5: 2 段の見出し「1号機｜2号機」。セルに「2(予備1)」「2+1」
await book('d5_gouki_text_cells.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', ''])
  ws.addRow(['', '', '', '1号機', '2号機'])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, '2(予備1)']); ws.addRow(['ソケット', 'PYF14A', 'オムロン', 2, '2+1']); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1])
})
// d6: 旧／新の変更図。削除した行（タイマ 三菱電機）の下の行のメーカーが「〃」
await book('d6_ditto_after_delete.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2]); ws.addRow(['タイマ', 'H3Y-2', '削除', '三菱電機', 1]); ws.addRow(['ブレーカ', 'NF32-SV', 'NF32-SVF', '〃', 1])
})
// d7: 表題欄に「製作台数 3台」、数量の列は「1台当り数量」
await book('d7_title_seisaku_daisu.xlsx', (ws) => {
  ws.addRow(['盤名', '制御盤A', '製作台数', '3台'])
  ws.addRow([])
  ws.addRow(['品名', '型式', 'メーカー', '1台当り数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1])
})
console.log(fs.readdirSync(D).join(' '))
