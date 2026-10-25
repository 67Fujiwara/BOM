// ラウンド14: 新人の手元の「汚い」BOM その 2（データ行の結合セル・〃／同上・変更図の削除行・未定の書き方・数式の合計・表題欄の結合）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r17/files14/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
const head = ['No', '品名', '型式', 'メーカー', '数量']

// a1: メーカーの列を縦に結合（同じメーカーが続く行。新人の Excel によくある）
await book('a1_merged_maker.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', '', 2]); ws.addRow([3, 'リレー', 'G2R-1', '', 6])
  ws.addRow([4, 'ブレーカ', 'NF32-SV', '三菱電機', 2]); ws.addRow([5, '電磁接触器', 'S-T10', '', 1])
  ws.mergeCells('D2:D4'); ws.mergeCells('D5:D6')
})
// a2: 品名を縦に結合（端子台 3 種類）＋ 分類の列を縦に結合
await book('a2_merged_name_cat.xlsx', (ws) => {
  ws.addRow(['分類', '品名', '型式', 'メーカー', '数量'])
  ws.addRow(['制御部', '端子台', 'XW2B-20G4', 'オムロン', 2]); ws.addRow(['', '', 'XW2B-40G4', 'オムロン', 1]); ws.addRow(['', '', 'XW2B-60G4', 'オムロン', 1])
  ws.addRow(['電源部', 'ブレーカ', 'NF32-SV', '三菱電機', 2])
  ws.mergeCells('A2:A4'); ws.mergeCells('B2:B4')
})
// a3: 数量を縦に結合（「セットで 2」のつもり）
await book('a3_merged_qty.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'コネクタ ハウジング', 'XG4M-2030', 'オムロン', 2]); ws.addRow([2, 'コネクタ 圧着端子', 'XG5W-0031', 'オムロン', '']); ws.addRow([3, 'リレー', 'MY4N-D2', 'オムロン', 4])
  ws.mergeCells('E2:E3')
})
// a4: 〃・同上・同左・”（全角の引用符）
await book('a4_ditto.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'リレー', 'MY2N-D2', '〃', 2]); ws.addRow([3, 'タイマ', 'H3CR-A8', '同上', 1])
  ws.addRow([4, '〃', 'H3CR-A8N', '〃', 1]); ws.addRow([5, 'ソケット', 'PYF14A', '”', 4]); ws.addRow([6, 'ソケット', 'PYF08A', '同左', 2])
})
// a5: 変更図（旧／新）で削除した行と追加した行。新の列が空・「削除」・「－」・数量 0
await book('a5_change_deleted.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量（旧）', '数量（新）', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4, '変更'])
  ws.addRow(['タイマ', 'H3Y-2', '', 'オムロン', 1, '', '削除'])
  ws.addRow(['ヒューズ', 'F-1A', '削除', '富士', 2, 0, ''])
  ws.addRow(['ランプ', 'L-1', '－', 'IDEC', 1, '－', '廃止'])
  ws.addRow(['端子台', '', 'XW2B-20G4', 'オムロン', '', 2, '追加'])
  ws.addRow(['ブレーカ', 'NF32-SV', 'NF32-SV', '三菱電機', 1, 1, ''])
})
// a6: 数式の合計（=SUM）、合計の行を A:D で結合
await book('a6_formula_total.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2])
  ws.addRow(['合計', '', '', '', { formula: 'SUM(E2:E3)', result: 6 }]); ws.mergeCells('A4:D4')
})
// a7: 表題欄を結合したセルで作った表（表題 A1:E1、作成者・日付・図番、見出しは 4 行目）
await book('a7_title_block_merged.xlsx', (ws) => {
  ws.addRow(['制御盤A 部品表', '', '', '', '']); ws.mergeCells('A1:E1')
  ws.addRow(['図番', 'DWG-001', '', '作成', '山田']); ws.mergeCells('B2:C2')
  ws.addRow(['', '', '', '', ''])
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2])
})
// a8: 未定の別の書き方
await book('a8_tbd_variants.xlsx', (ws) => {
  ws.addRow(head)
  const v = [['未定（10月決定）', 'オムロン'], ['要確認', 'オムロン'], ['後日連絡', 'IDEC'], ['TBD by 10/30', 'TBD'], ['？', '？'], ['ー', 'ー'], ['N/A', 'N/A'], ['決まり次第', 'メーカー不問'], ['MY4N-D2', '任意'], ['MY4N-D2', '指定なし']]
  v.forEach(([m, k], i) => ws.addRow([i + 1, `部品${i + 1}`, m, k, 1]))
})
// a9: 数量の書き方 その 2（予備込み・×・約・※）
await book('a9_qty_notes.xlsx', (ws) => {
  ws.addRow(head)
  const q = ['2個×2', '4(予備含)', '2 ※1', '約10', '1+1(予備)', '2/台', '3台分', '１０']
  q.forEach((x, i) => ws.addRow([i + 1, `部品${i + 1}`, `Q-${i + 1}`, 'オムロン', x]))
})
console.log('ok')
