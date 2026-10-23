// ラウンド9 のテスト用ファイル
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r10/files9/'
fs.mkdirSync(D, { recursive: true })
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
const head = ['No', '品名', '形式', 'メーカー', '員数', '備考']
// 隠したシート（旧版）が先、見えるシート（最新）が後。シート名はどちらも普通
await save('b1_hidden_sheet.xlsx', (wb) => { const o = wb.addWorksheet('部品表'); o.state = 'hidden'; o.addRow(head); o.addRow([1, 'リレー', 'MY2N-OLD', 'オムロン', 4, '']); o.addRow([2, 'タイマ', 'H3Y-OLD', 'オムロン', 2, ''])
  const n = wb.addWorksheet('部品表 (2)'); n.addRow(head); n.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, '']); n.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, '']) })
// 旧型式の見出し（右・左・括弧書き・変更前/後・Old/New）
await save('b2_old_right.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['品名', '型式', '旧型式', 'メーカー', '数量'])
  ws.addRow(['リレー', 'MY4N-D2', 'MY2N', 'オムロン', 4]); ws.addRow(['タイマ', 'H3CR-A8', 'H3Y', 'オムロン', 2]) })
await save('b3_old_paren.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量（旧）', '数量（新）'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow(['タイマ', 'H3Y', 'H3CR-A8', 'オムロン', 1, 2]) })
await save('b4_before_after.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['品名', '変更前型式', '変更後型式', 'メーカー', '員数'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['タイマ', 'H3Y', 'H3CR-A8', 'オムロン', 2]) })
await save('b5_old_new_en.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['Description', 'Old P/N', 'New P/N', 'Manufacturer', 'Qty'])
  ws.addRow(['Relay', 'MY2N', 'MY4N-D2', 'OMRON', 4]); ws.addRow(['Timer', 'H3Y', 'H3CR-A8', 'OMRON', 2]) })
// 合計の書き方 その 3
await save('b6_totals3.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N', 'オムロン', 4, '']); ws.addRow([2, 'タイマ', 'H3CR', 'オムロン', 2, ''])
  for (const t of ['【合計】', '＜合計＞', '合計 ：', '合計 6点', 'TOTAL', 'Total Qty', '計 6', '小計(制御部)', '＊合計＊', '-- 以下余白 --', '以下余白', '計：6個', '合計数量 6', '合　計　数']) ws.addRow(['', t, '', '', 6, '']) })
// 区切りの行 その 2（No 列だけ・名前の列だけ・番号付き・山括弧）
await save('b7_sections2.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head)
  ws.addRow(['【電源部】']); ws.addRow([1, '電源', 'S8VK-G06024', 'オムロン', 1, ''])
  ws.addRow(['', '◆操作部']); ws.addRow([2, '押ボタン', 'A22NN-BNM', 'オムロン', 3, ''])
  ws.addRow(['', '1. 制御部']); ws.addRow([3, 'リレー', 'MY4N-D2', 'オムロン', 4, ''])
  ws.addRow(['', '<端子部>']); ws.addRow([4, '端子台', 'XW2B-20G4', 'オムロン', 2, '']) })
// 分類の列を結合セルにした表（新人がよく作る）
await save('b8_merged.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['分類', '品名', '形式', 'メーカー', '員数'])
  ws.addRow(['制御', 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow(['', 'タイマ', 'H3CR-A8', 'オムロン', 2]); ws.addRow(['', 'リレー', 'G2R-1', 'オムロン', 6])
  ws.addRow(['電源', '電源', 'S8VK-G06024', 'オムロン', 1]); ws.addRow(['', 'ブレーカ', 'NF32-SV', '三菱電機', 2])
  ws.mergeCells('A2:A4'); ws.mergeCells('A5:A6') })
// 員数に単位付き・セット
await save('b9_units.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['品名', '形式', 'メーカー', '員数'])
  ws.addRow(['電線', 'KIV 1.25SQ', '住友電装', '20m']); ws.addRow(['ボルト', 'M4x10', 'X社', '10本']); ws.addRow(['端子', 'R1.25-4', 'ニチフ', '1袋']); ws.addRow(['盤', 'BX-1', 'Y社', '1台']); ws.addRow(['ラベル', 'L-2', 'Z社', '2 set']) })
// Shift_JIS の CSV（日本語の Excel の「CSV（コンマ区切り）」）
console.log('ok')
