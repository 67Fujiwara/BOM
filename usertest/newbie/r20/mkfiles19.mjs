// ラウンド19: 新人の手元の BOM その 7（ラウンド18 の直しの周り: 結合した表題欄の製作台数・変更図の備考の言葉・セル内改行の見出し・
// 号機と実装の列・縦に結合した品名・2 段の号機別数量・半角カナの見出し）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r20/files19/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
const wrap = { wrapText: true, vertical: 'top' }
// f1: 結合した表題（部 品 表）と、別々のセルの「製作台数｜3｜台」、1台当り数量
await book('f1_title_merged_daisu.xlsx', (ws) => {
  ws.addRow(['部 品 表', '', '', '', ''])
  ws.mergeCells('A1:E1')
  ws.addRow(['盤名', '制御盤A', '製作台数', 3, '台'])
  ws.addRow([])
  ws.addRow(['品名', '型式', 'メーカー', '1台当り数量', '備考'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, ''])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, ''])
})
// f2: 設計変更の様式（変更前｜変更後を結合）。変えた行だけ変更後。新が空の行の備考に「削除しました」「不要のため削除」「削除はしない」「欠番」
await book('f2_change_form_note_words.xlsx', (ws) => {
  ws.addRow(['', '変更前', '変更後', '', ''])
  ws.addRow(['品名', '型式', '型式', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, '型式変更'])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '削除しました'])
  ws.addRow(['ソケット', 'PYF14A', '', 2, '不要のため削除'])
  ws.addRow(['ランプ', 'L-1', '', 1, '削除はしない'])
  ws.addRow(['ヒューズ', 'F-5A', '', 3, '欠番'])
  ws.addRow(['端子台', 'XW2B-20G4', '', 4, ''])
})
// f3: 見出しのセル内改行（「数量⏎(1台分)」）、表題の製作台数、備考のセル内改行にコンマ
await book('f3_multiline_header_daisu.xlsx', (ws) => {
  ws.addRow(['盤名：制御盤B', '', '製作台数：2台', '', ''])
  ws.addRow(['品名', '型式', 'メーカー', '数量\n(1台分)', '備考\n(取付位置)'])
  ws.getRow(2).eachCell((c) => { c.alignment = wrap })
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, '盤内上段,\n左側'])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, ''])
  ws.getCell('E3').alignment = wrap
})
// f4: 号機の列（空のセルあり）と実装の列（○／×）
await book('f4_gouki_jissou.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '1号機', '2号機', '3号機', '実装'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, null, 2, '○'])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', null, 1, null, '○'])
  ws.addRow(['ランプ', 'L-1', 'IDEC', 1, 1, 1, '×'])
  ws.addRow(['ソケット', 'PYF14A', 'オムロン', 2, 2, 2, '○'])
})
// f5: 品名・メーカーを縦に結合（同じ品名の型式違い）
await book('f5_merged_vertical_name.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4])
  ws.addRow(['', 'MY2N', '', 2])
  ws.addRow(['', 'G2R-1', '', 1])
  ws.mergeCells('A2:A4'); ws.mergeCells('C2:C4')
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1])
})
// f6: 2 段の見出し（上の段「号機別数量」を結合、下の段 1｜2｜3）
await book('f6_two_tier_goukibetsu.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '号機別数量', '', ''])
  ws.addRow(['', '', '', 1, 2, 3])
  ws.mergeCells('D1:F1'); ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 2])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 1])
})
// f7: 古い基幹システムから出した半角カナの見出し（ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ）
await book('f7_halfkana_headers.xlsx', (ws) => {
  ws.addRow(['ﾋﾝﾒｲ', 'ｶﾀｼｷ', 'ﾒｰｶｰ', 'ｽｳﾘｮｳ'])
  ws.addRow(['ﾘﾚｰ', 'MY4N-D2', 'ｵﾑﾛﾝ', 4])
  ws.addRow(['反射フィルム', 'RF-200', 'DNP', 2])
  ws.addRow(['ﾀｲﾏ', 'H3CR-A8', 'ｵﾑﾛﾝ', 1])
})
console.log(fs.readdirSync(D))
