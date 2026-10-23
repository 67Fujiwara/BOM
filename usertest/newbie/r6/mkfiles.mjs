import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const D = '/home/user/BOM/usertest/newbie/r6/files/'
const head = ['No', '品名', '形式', 'メーカー', '員数', '備考']
const data = [[1, 'リレー', 'MY4N-D2 DC24', 'オムロン', 4, ''], [2, 'タイマ', 'H3CR-A8 AC100-240', 'オムロン', 2, '予備1'], [3, 'ブレーカ', 'NF32-SV 2P 10A', '三菱電機', 1, ''], [4, '端子台', 'XW2B-20G4', 'オムロン', 3, '']]
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
// g: 表題欄（品名・図番が並ぶ）の下に部品表
await save('g_titleblock.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['品名', '第4ライン 制御盤', '', '図番', 'E-1234']); ws.addRow(['作成', '山田', '', '日付', '2026/10/20']); ws.addRow([]); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
// h: 見出しが 12 行目（表題欄が長い）
await save('h_deep.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['部品リスト']); for (let i = 0; i < 9; i++) ws.addRow([`項目${i + 1}`, `値${i + 1}`]); ws.addRow([]); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
// i: 3 枚（表紙に表題欄・改訂履歴・部品表）
await save('i_sheets3.xlsx', (wb) => { const c = wb.addWorksheet('表紙'); c.addRow(['品名', '第4ライン 制御盤']); c.addRow(['図番', 'E-1234']); c.addRow(['客先', 'ABC 工業']); const r = wb.addWorksheet('改訂履歴'); r.addRow(['版', '日付', '内容', '担当']); r.addRow(['A', '2026/9/1', '初版', '山田']); r.addRow(['B', '2026/10/1', 'リレー追加', '山田']); r.addRow(['C', '2026/10/15', 'ブレーカ変更', '田中']); r.addRow(['D', '2026/10/18', '端子台追加', '田中']); r.addRow(['E', '2026/10/20', '数量見直し', '田中']); const ws = wb.addWorksheet('部品表'); ws.addRow(head); data.forEach((x) => ws.addRow(x)) })
// j: 2 枚の部品表（旧版が先、新版が後。新版の方が行が少ない）
await save('j_two_boms.xlsx', (wb) => { const a = wb.addWorksheet('旧版'); a.addRow(head); [...data, [5, 'ヒューズ', 'F-1', 'X社', 1, ''], [6, 'ランプ', 'L-1', 'Y社', 1, '']].forEach((x) => a.addRow(x)); const b = wb.addWorksheet('最新版'); b.addRow(head); data.slice(0, 3).forEach((x) => b.addRow(x)) })
// k: 数量が「4個」「2 本」・型式が数値・数式
await save('k_values.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N', 'オムロン', '4個', '']); ws.addRow([2, '電線', 'KIV 1.25', '住友電装', '20 m', '']); ws.addRow([3, 'ナット', 1234, 'X社', { formula: 'E2*2', result: 8 }, '']); ws.addRow([4, '抵抗', '0805', 'KOA', '1,000', '']) })
// m: 見出しが 2 行（大見出し + 小見出し）
await save('m_twoheader.xlsx', (wb) => { const ws = wb.addWorksheet('BOM'); ws.addRow(['', '部品', '', '', '数量', '']); ws.addRow(head); data.forEach((r) => ws.addRow(r)) })
console.log('ok')
