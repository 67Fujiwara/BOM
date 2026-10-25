// ラウンド15: 新人の手元の BOM その 3（見積書風の列の並び・見出しの行のページ番号・変更記号の列・変更後だけ書いた変更図に追加の行・削除の別の書き方・〃の別の書き方・縦横に結合したセル）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r17/files15/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// b1: 見積書・購入品リスト風（品名｜規格｜メーカー｜単価｜数量｜金額）
await book('b1_estimate_cols.xlsx', (ws) => {
  ws.addRow(['No', '品名', '規格', 'メーカー', '単価', '数量', '金額'])
  ws.addRow([1, 'リレー', 'MY4N-D2 DC24', 'オムロン', 1200, 4, { formula: 'E2*F2', result: 4800 }])
  ws.addRow([2, 'タイマ', 'H3CR-A8 AC100-240', 'オムロン', 3000, 2, { formula: 'E3*F3', result: 6000 }])
  ws.addRow([3, 'ブレーカ', 'NF32-SV 2P 10A', '三菱電機', 2500, 1, { formula: 'E4*F4', result: 2500 }])
})
// b2: 品名｜仕様｜型式｜単価｜数量｜金額（メーカーの列なし）
await book('b2_spec_price.xlsx', (ws) => {
  ws.addRow(['品名', '仕様', '型式', '単価', '数量', '金額'])
  ws.addRow(['リレー', 'DC24V 4c', 'MY4N-D2', 1200, 4, 4800]); ws.addRow(['タイマ', 'AC100V', 'H3CR-A8', 3000, 2, 6000])
})
// b3: 見出しの行の右端にページ番号（頁｜1）
await book('b3_header_pageno.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', '', '頁', 1])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2])
})
// b4: 回路記号と変更記号（図面の部品表）
await book('b4_change_mark.xlsx', (ws) => {
  ws.addRow(['記号', '品名', '型式', 'メーカー', '数量', '変更記号'])
  ws.addRow(['K1', 'リレー', 'MY4N-D2', 'オムロン', 1, '△1']); ws.addRow(['K2', 'リレー', 'MY4N-D2', 'オムロン', 1, '']); ws.addRow(['T1', 'タイマ', 'H3CR-A8', 'オムロン', 1, '△2'])
})
// b5: 変更後だけ書く変更図（変えない行は空）に、追加の行が 1 行
await book('b5_change_after_add.xlsx', (ws) => {
  ws.addRow(['品名', '型式', '変更後型式', 'メーカー', '数量', '変更後数量'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow(['タイマ', 'H3CR-A8', '', 'オムロン', 1, ''])
  ws.addRow(['ブレーカ', 'NF32-SV', '', '三菱電機', 1, '']); ws.addRow(['端子台', '', 'XW2B-20G4', 'オムロン', '', 2])
})
// b6: 旧／新の変更図で削除を「撤去」「不要」「なし」「（削除）」「×」と書く
await book('b6_delete_words.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量（旧）', '数量（新）'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow(['タイマ', 'H3Y-2', '（削除）', 'オムロン', 1, ''])
  ws.addRow(['ランプ', 'L-1', '撤去', 'IDEC', 1, '']); ws.addRow(['ヒューズ', 'F-1A', 'なし', '富士', 2, ''])
  ws.addRow(['ソケット', 'PYF14A', '不要', 'オムロン', 2, '']); ws.addRow(['ファン', 'F-60', '×', '日本電産', 1, ''])
})
// b7: 〃の別の書き方（″・同　上・＂・上に同じ）
await book('b7_ditto_more.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'リレー', 'MY2N-D2', '″', 2]); ws.addRow([3, 'タイマ', 'H3CR-A8', '同　上', 1])
  ws.addRow([4, 'ソケット', 'PYF14A', '＂', 4]); ws.addRow([5, 'ソケット', 'PYF08A', '上に同じ', 2])
})
// b8: 縦横に結合したセル（品名と型式の 2 列 × 2 行を 1 つに: 「端子台 XW2B」セット）
await book('b8_merged_block.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量'])
  ws.addRow([1, '端子台セット XW2B', '', 'オムロン', 2]); ws.addRow([2, '', '', 'オムロン', 1]); ws.addRow([3, 'リレー', 'MY4N-D2', 'オムロン', 4])
  ws.mergeCells('B2:C3')
})
// b9: 2 段の見出しで「品名」「型式」を縦に結合（A1:A2）、数量の下に号機
await book('b9_twotier_vmerge.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '', ''])
  ws.addRow(['', '', '', '1号機', '2号機', '合計'])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:F1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 4]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 2])
})
console.log('ok')
