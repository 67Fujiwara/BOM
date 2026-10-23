// ラウンド10: ページごとに見出しを繰り返した長い部品表
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r11/files10b/'
fs.mkdirSync(D, { recursive: true })
const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表')
const head = ['No', '品名', '型式', 'メーカー', '数量']
ws.addRow(head)
for (let i = 1; i <= 30; i++) ws.addRow([i, `部品${i}`, `M-${i}`, 'オムロン', i])
ws.addRow(head)
for (let i = 31; i <= 40; i++) ws.addRow([i, `部品${i}`, `M-${i}`, 'オムロン', i])
await wb.xlsx.writeFile(D + 'f1_repeat_header.xlsx')
const wb2 = new ExcelJS.Workbook(); const w2 = wb2.addWorksheet('部品表')
w2.addRow(['制御盤A 部品表']); w2.addRow(head); w2.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); w2.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]); w2.addRow([]); w2.addRow(['（2/2 ページ）']); w2.addRow(head); w2.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', 1])
await wb2.xlsx.writeFile(D + 'f2_page2_header.xlsx')
console.log('ok')
