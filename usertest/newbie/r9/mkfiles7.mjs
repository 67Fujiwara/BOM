// ラウンド7 のテスト用ファイル
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r9/files7/'
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
const tsv = '部品表 第5ライン\t\t\t\t\n作成\t山田\t\t\t\n記号\t品名\t形式\tメーカー\t員数\nr1\t抵抗\tRD16S 1K\tKOA\t2\nc10\tコンデンサ\tUVR1H101MED\tニチコン\t1\nk1\tリレー\tMY4N-D2\tオムロン\t4\n\t合計\t\t\t7\n'
const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(tsv.replace(/\n/g, '\r\n'), 'utf16le')])
fs.writeFileSync(D + 'w_utf16le.txt', le)
const be = Buffer.from(tsv.replace(/\n/g, '\r\n'), 'utf16le'); for (let i = 0; i < be.length; i += 2) { const t = be[i]; be[i] = be[i + 1]; be[i + 1] = t }
fs.writeFileSync(D + 'w_utf16be.txt', Buffer.concat([Buffer.from([0xfe, 0xff]), be]))
// UTF-16 なのに拡張子 .csv（Excel の「Unicode テキスト」を .csv に名前を変えた）
fs.writeFileSync(D + 'w_utf16le_as.csv', le)
// 数式のセル（結果あり / 結果なし）
await save('x_formula.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数', '単価'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', { formula: '2*2', result: 4 }, 1200])
  ws.addRow([2, 'タイマ', { formula: '"H3CR-"&"A8"' }, 'オムロン', 2, 3000])
  ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', { formula: 'E2+1' }, 5000])
  ws.addRow([4, '端子台', 'XW2B-20G4', { formula: 'D2', result: 'オムロン' }, 3, 800]) })
// エラーのセル（#N/A・#DIV/0!・#NAME?）
await save('y_errors.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数'])
  ws.addRow([1, 'リレー', 'MY4N-D2', { error: '#N/A' }, 4])
  ws.addRow([2, 'タイマ', { error: '#NAME?' }, 'オムロン', 2])
  ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', { error: '#DIV/0!' }])
  ws.addRow([4, { error: '#REF!' }, 'XW2B-20G4', 'オムロン', 3]) })
// 合計の書き方いろいろ（「計」「TOTAL」「総計」）と表題欄
await save('z_totals.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['部品表', '', '図番', 'D-123']); ws.addRow(['承認', '', '作成', '山田']); ws.addRow([])
  ws.addRow(['No', '品名', '形式', 'メーカー', '員数']); ws.addRow([1, 'リレー', 'MY4N', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR', 'オムロン', 2])
  ws.addRow(['', '計', '', '', 6]); ws.addRow(['', 'TOTAL', '', '', 6]); ws.addRow(['', '総計', '', '', 6]); ws.addRow(['', '', '', '合計金額', 12000]) })
// 「計器」「計装ケーブル」など「計」で始まる本物の部品（合計と取り違えない？）
await save('z_kei_parts.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数']); ws.addRow([1, '計器', 'K3HB-X', 'オムロン', 1]); ws.addRow([2, '計装ケーブル', 'KPEV-S', '住友電装', 10]); ws.addRow([3, 'カウンタ', 'H7CX', 'オムロン', 1]); ws.addRow([4, '合計器', 'H7ET', 'オムロン', 1]) })
console.log('ok')
