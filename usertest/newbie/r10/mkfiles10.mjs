// ラウンド10 のテスト用ファイル
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const D = '/home/user/BOM/usertest/newbie/r10/files10/'
fs.mkdirSync(D, { recursive: true })
async function save(name, fn) { const wb = new ExcelJS.Workbook(); fn(wb); await wb.xlsx.writeFile(D + name) }
// e1: 空のセル＋隠した列＋隠した行＋フィルタで隠れた行（同じシート）
await save('e1_blank_hidden.xlsx', (wb) => { const ws = wb.addWorksheet('部品表')
  ws.addRow(['回路記号', '品名', '旧型式', '形式', 'メーカー', '員数', '備考', '予備'])
  ws.addRow(['K1', 'リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, '', 1])
  ws.addRow(['', 'ダクト', 'HD-2', 'HD-3', '', 2, '現場合わせ', ''])
  ws.addRow(['T1', 'タイマ', '', 'H3CR-A8', 'オムロン', 2, '', ''])
  ws.addRow(['X9', '削除品', 'OLD-1', 'OLD-1', 'X社', 9, '廃止', ''])
  ws.addRow(['', 'ブレーカ', '', 'NF32-SV', '三菱電機', 3, '', 1])
  ws.getColumn(3).hidden = true; ws.getRow(5).hidden = true })
// e2: 旧・新の見出しのいろいろ
const pairs = [['型式（旧）', '型式（新）'], ['型式(旧)', '型式(新)'], ['旧型式', '新型式'], ['型式 旧', '型式 新'], ['型式（変更前）', '型式（変更後）'], ['形式(old)', '形式(new)'], ['型式', '型式（旧）']]
let k = 0
for (const [a, b] of pairs) {
  k++
  await save(`e2_${k}_oldnew.xlsx`, (wb) => { const ws = wb.addWorksheet('BOM'); const oldFirst = !/旧|old/i.test(b)
    ws.addRow(['品名', a, b, 'メーカー', '数量'])
    ws.addRow(oldFirst ? ['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4] : ['リレー', 'MY4N-D2', 'MY2N', 'オムロン', 4]) })
}
// e3: 複数シート（表紙・部品表・改訂履歴・部品表(旧)）
await save('e3_multisheet.xlsx', (wb) => {
  const c = wb.addWorksheet('表紙'); c.addRow(['部品表']); c.addRow(['品名', '制御盤A']); c.addRow(['図番', 'E-100'])
  const h = wb.addWorksheet('改訂履歴'); h.addRow(['Rev', '日付', '品名', '型式', '内容']); h.addRow(['A', '2026/10/1', 'リレー', 'MY2N', '初版'])
  const b = wb.addWorksheet('部品表'); b.addRow(['No', '品名', '型式', 'メーカー', '数量']); b.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); b.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2])
  const o = wb.addWorksheet('部品表(旧)'); o.addRow(['No', '品名', '型式', 'メーカー', '数量']); o.addRow([1, 'リレー', 'MY2N', 'オムロン', 4]); o.addRow([2, 'タイマ', 'H3Y', 'オムロン', 2]); o.addRow([3, 'ヒューズ', 'F-1', 'X社', 5]) })
// e4: 合計・区切りの書き方 その 4、〃・同上
await save('e4_totals4.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['No', '品名', '形式', 'メーカー', '員数', '備考'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, '']); ws.addRow([2, 'タイマ', 'H3CR-A8', '〃', 2, '']); ws.addRow([3, 'リレー', 'G2R-1', '同上', 6, ''])
  for (const t of ['合計：', 'Total', 'TOTAL 12', '計(12点)', '合計 12 個', '計 12 pcs', '合計（12点）', '※以下余白', '＝＝＝＝', '合計金額 ¥12,000', '総数', '部品点数 3']) ws.addRow(['', t, '', '', 12, '']) })
// e5: 先頭の列と上の行が空（B3 から始まる表）、数式の員数、セル内改行
await save('e5_offset.xlsx', (wb) => { const ws = wb.addWorksheet('Sheet1')
  ws.getCell('B1').value = '制御盤 部品表'
  ws.getCell('B3').value = '品名'; ws.getCell('C3').value = '型式'; ws.getCell('D3').value = 'メーカ'; ws.getCell('E3').value = '数量'; ws.getCell('F3').value = '単位'
  ws.getCell('B4').value = 'リレー'; ws.getCell('C4').value = 'MY4N-D2'; ws.getCell('D4').value = 'オムロン'; ws.getCell('E4').value = { formula: '2*2', result: 4 }; ws.getCell('F4').value = '個'
  ws.getCell('B5').value = '電線'; ws.getCell('C5').value = 'KIV\n1.25SQ'; ws.getCell('D5').value = '住友電装'; ws.getCell('E5').value = 20; ws.getCell('F5').value = 'm'
  ws.getCell('B6').value = 'ネジ'; ws.getCell('C6').value = 'M4x10'; ws.getCell('D6').value = ''; ws.getCell('E6').value = '１０'; ws.getCell('F6').value = '本' })
// e6: CSV いろいろ
const csv = '品名,型式,メーカー,数量,備考\r\nリレー,MY4N-D2,オムロン,4,\r\n抵抗,"RK73B 1/4W",KOA,"1,000","予備含む, 盤内"\r\n合計,,,"1,004",\r\n'
fs.writeFileSync(D + 'e6a_utf8bom.csv', '﻿' + csv)
fs.writeFileSync(D + 'e6b_utf16le_nobom.txt', Buffer.from(csv.replace(/,/g, '\t').replace(/"/g, ''), 'utf16le'))
const be = Buffer.from('﻿' + csv.replace(/,/g, '\t').replace(/"/g, ''), 'utf16le'); for (let i = 0; i < be.length; i += 2) { const t = be[i]; be[i] = be[i + 1]; be[i + 1] = t }
fs.writeFileSync(D + 'e6c_utf16be_bom.txt', be)
fs.writeFileSync(D + 'e6d_sjis.csv', execFileSync('python3', ['-c', 'import sys;sys.stdout.buffer.write(sys.stdin.read().encode("cp932"))'], { input: csv }))
fs.writeFileSync(D + 'e6e_semicolon.csv', '品名;型式;メーカー;数量\nリレー;MY4N-D2;オムロン;4\n')
// e7: 1 シートに 2 つの表（上: 部品、下: 予備品）
await save('e7_two_tables.xlsx', (wb) => { const ws = wb.addWorksheet('部品表'); ws.addRow(['品名', '型式', 'メーカー', '数量']); ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([]); ws.addRow(['予備品']); ws.addRow(['品名', '型式', 'メーカー', '数量']); ws.addRow(['ヒューズ', 'F-1', 'X社', 10]) })
console.log('ok', fs.readdirSync(D).join(' '))
