import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r3/files/'
const head = ['品名', '形式', 'メーカー', '員数', '備考']
const data = [['リレー', 'MY4N-D2 DC24', 'オムロン', 4, ''], ['タイマ', 'H3CR-A8 AC100-240', 'オムロン', 2, '予備1'], ['ブレーカ', 'NF32-SV 2P 10A', '三菱電機', 1, '']]
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
// a: 表題行つき
await save('a_title.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['部品表 第4ライン 制御盤']); ws.addRow([]); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
// a2: 表題が「部品」で始まらない
await save('a2_title.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['第4ライン 制御盤 使用部品一覧']); ws.addRow(['作成: 山田', '', '', '2026/10/20']); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
// b: リッチテキスト（一部太字）・数式・エラー値
await save('b_rich.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(head); ws.addRow([{ richText: [{ text: 'リレー' }, { font: { bold: true }, text: '（重要）' }] }, 'MY4N-D2 DC24', 'オムロン', { formula: '2*2', result: 4 }, '']); ws.addRow(['タイマ', { richText: [{ text: 'H3CR-' }, { font: { color: { argb: 'FFFF0000' } }, text: 'A8' }] }, 'オムロン', 2, { error: '#N/A' }]) })
// c: 1 枚目が表紙
await save('c_cover.xlsx', (wb) => { const c = wb.addWorksheet('表紙'); c.addRow(['第4ライン 制御盤']); c.addRow(['改訂履歴']); const ws = wb.addWorksheet('部品表'); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
// d: CSV UTF-8 BOM 付き
fs.writeFileSync(D + 'd_bom.csv', '﻿' + [head, ...data].map((r) => r.join(',')).join('\r\n'))
// e: 列 A が空（B 列から表）
await save('e_offset.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow([null, ...head]); data.forEach((r) => ws.addRow([null, ...r])) })
// f: 途中に空セル
await save('f_holes.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(head); ws.addRow(['リレー', null, 'オムロン', 4, '型式未定']); ws.addRow(['タイマ', 'H3CR-A8', null, 2, null]) })
console.log(fs.readdirSync(D))
