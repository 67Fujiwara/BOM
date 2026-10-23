// ラウンド8 のテスト用ファイル
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r11/files8/'
fs.mkdirSync(D, { recursive: true })
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
const head = ['No', '品名', '形式', 'メーカー', '員数', '備考']
// 合計の書き方（全角空白入り・括弧つき・総合計・以下余白・ラベルと数が 1 セル）
await save('aa_totals2.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N', 'オムロン', 4, '']); ws.addRow([2, 'タイマ', 'H3CR', 'オムロン', 2, ''])
  ws.addRow(['', '合　計', '', '', 6, '']) // 全角空白
  ws.addRow(['', '小 計', '', '', 6, '']) // 半角空白
  ws.addRow(['', '合計（税抜）', '', '', 6, ''])
  ws.addRow(['', '総合計', '', '', 6, ''])
  ws.addRow(['', '計：6個', '', '', '', ''])
  ws.addRow(['', '', '', '', '', '以下余白']) })
// 表紙 + 表題欄の長い部品表（見出しが 13 行目）
await save('ab_cover_deep.xlsx', (wb) => { const c = wb.addWorksheet('表紙'); c.addRow(['品名', '第4ライン 制御盤']); c.addRow(['図番', 'E-1234']); c.addRow(['数量', '1 式'])
  const ws = wb.addWorksheet('部品表'); ws.addRow(['部品表']); for (let i = 0; i < 10; i++) ws.addRow([`項目${i + 1}`, `値${i + 1}`]); ws.addRow([]); ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, '']); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, '']); ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', 1, '']) })
// 隠した列（旧型式）が新しい型式の左にある
await save('ac_hidden_col.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', '形式', 'メーカー', '員数'])
  ws.addRow([1, 'リレー', 'MY2N-OLD', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3Y-OLD', 'H3CR-A8', 'オムロン', 2]); ws.getColumn(3).hidden = true })
// 部品の間に「■ 電源部」などの区切りの行（1 セルだけ）
await save('ad_sections.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head); ws.addRow(['', '■ 制御部']); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, '']); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, ''])
  ws.addRow(['【電源部】']); ws.addRow([3, '電源', 'S8VK-G06024', 'オムロン', 1, '']) })
// 数量・型式のいろいろ
await save('ae_values.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head)
  ws.addRow([1, '抵抗', 'RK73B1JTTD102J', 'KOA', '1,000', '']); ws.addRow([2, 'ナット', 'M3', 'X社', '１０', '全角']); ws.addRow([3, '盤', 'ABC', 'Y社', '1式', ''])
  ws.addRow([4, 'グリス', 'G-1', 'Z社', '適量', '']); ws.addRow([5, '電線', 'KIV2SQ', '住友電装', '0.5m', '']); ws.addRow([6, 'コンデンサ', 0.0000047, 'ニチコン', 2, '型式が数値'])
  ws.addRow([7, 'スペーサ', 2200, 'W社', 4, '型式が整数']); ws.addRow([8, 'ヒューズ', 'F-1', 'V社', -1, 'マイナス']); ws.addRow([9, 'ラベル', 'L-1', 'U社', 2.5, '小数']) })
// 共有数式（結果なし）
await save('af_shared_formula.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N', 'オムロン', 4, ''])
  ws.getCell('E3').value = { formula: 'E2*2' }; ws.getCell('A3').value = 2; ws.getCell('B3').value = 'タイマ'; ws.getCell('C3').value = 'H3CR'; ws.getCell('D3').value = 'オムロン'
  ws.getCell('E4').value = { sharedFormula: 'E3' }; ws.getCell('A4').value = 3; ws.getCell('B4').value = 'ブレーカ'; ws.getCell('C4').value = 'NF32'; ws.getCell('D4').value = '三菱電機' })
// UTF-8 BOM 付き CSV、最後に合計の行、セル内改行
fs.writeFileSync(D + 'ag_utf8bom.csv', '﻿' + ['品名,形式,メーカー,員数,備考', 'リレー,MY4N-D2,オムロン,4,"予備1\n盤内"', 'タイマ,"H3CR-A8, AC100-240",オムロン,2,', '合計,,,6,', ''].join('\r\n'))
// 見積回答（全角空白の合計・以下余白）
console.log('ok')
