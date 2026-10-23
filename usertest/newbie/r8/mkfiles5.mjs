// ラウンド5 で足すテスト用ファイル
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r8/files5/'
const data = [[1, 'リレー', 'MY4N-D2 DC24', 'オムロン', 4, ''], [2, 'タイマ', 'H3CR-A8 AC100-240', 'オムロン', 2, '予備1'], [3, 'ブレーカ', 'NF32-SV 2P 10A', '三菱電機', 1, ''], [4, '端子台', 'XW2B-20G4', 'オムロン', 3, '']]
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
// p: 数量の見出しが「使用数」
await save('p_shiyousu.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '型式', 'メーカ', '使用数', '備考']); data.forEach((r) => ws.addRow(r)) })
// q: 「メーカー型式」「Q'ty」
await save('q_makermodel.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '部品名', 'メーカー型式', 'メーカー', "Q'ty", '備考']); data.forEach((r) => ws.addRow(r)) })
// r: 表題欄に 品名・型式・数量・備考（見出しと同じ数の見出し語）
await save('r_titleblock2.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['品名', '第4ライン制御盤', '型式', 'CP-4L', '数量', '1台', '備考', '客先 ABC']); ws.addRow(['作成', '山田', '承認', '田中']); ws.addRow([]); ws.addRow(['No', '品名', '形式', 'メーカー', '員数']); data.forEach((r) => ws.addRow(r.slice(0, 5))) })
// s: 分類ごとに空行と「小計」行、最後に「合計」行
await save('s_subtotal.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数', '備考']); ws.addRow(data[0]); ws.addRow(data[1]); ws.addRow(['', '小計', '', '', 6, '']); ws.addRow([]); ws.addRow(data[2]); ws.addRow(data[3]); ws.addRow(['', '小計', '', '', 4, '']); ws.addRow(['', '合計', '', '', 10, '']) })
// u: 単位つきの数量
await save('u_units.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数']); ws.addRow([1, 'リレー', 'MY4N', 'オムロン', '4 pcs']); ws.addRow([2, '電線', 'KIV 1.25', '住友電装', '0.5 m']); ws.addRow([3, '圧着端子', 'R1.25-3', 'ニチフ', '1袋']); ws.addRow([4, '配線材', '-', '-', '1式']); ws.addRow([5, 'ネジ', 'M4x10', 'X社', '2set']) })
// t: 海外 CAD の CSV（Item が行番号、Description が部品名）
fs.writeFileSync(D + 't_english.csv', 'Item,Qty,Reference,Description,Manufacturer,Manufacturer Part Number\n1,4,"K1,K2,K3,K4",Relay,Omron,MY4N-D2\n2,2,"T1,T2",Timer,Omron,H3CR-A8\n3,1,CB1,Breaker,Mitsubishi,NF32-SV\n')
// v: CSV で表題行 2 行 + 見出し + 「Ref Des」
fs.writeFileSync(D + 'v_title.csv', '部品表 第4ライン,,,,\n作成日,2026/10/20,,,\nRef Des,Part Name,Part Number,Maker,Qty\nK1,Relay,MY4N-D2,Omron,4\nT1,Timer,H3CR-A8,Omron,2\n')
console.log('ok')
