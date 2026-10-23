// 空のセル（Excel で何も入れていないセル）が行の途中にある普通の部品表
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const D = '/home/user/BOM/usertest/newbie/r9/files9b/'
import fs from 'node:fs'; fs.mkdirSync(D, { recursive: true })
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
// 回路記号が一部空・メーカーが一部空（よくある）
await save('d1_blank_cells.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['回路記号', '品名', '形式', 'メーカー', '員数', '備考'])
  ws.addRow(['K1', 'リレー', 'MY4N-D2', 'オムロン', 4, null]); ws.addRow([null, 'ダクト', 'HD-3', null, 2, '現場合わせ']); ws.addRow(['T1', 'タイマ', 'H3CR-A8', 'オムロン', 2, null]) })
// 備考が空で、員数の右に数の列（予備数）がある → 黙って数量がずれる
await save('d2_silent_qty.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['品名', '形式', 'メーカー', '備考', '員数', '予備数'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', '盤内', 12, 2]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', null, 4, 1]); ws.addRow(['ブレーカ', 'NF32-SV', '三菱電機', null, 3, 1]) })
console.log('ok')
