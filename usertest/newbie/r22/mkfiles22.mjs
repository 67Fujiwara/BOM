// ラウンド22: 新人の手元の BOM その 10（ラウンド21 の直しの周り）→ files22/
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r22/files22/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build, sheet = '部品表') { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// g1: 変更内容 + 備考。変更内容の「削除」は効く／括弧の注記つき／保留
await book('g1_change_content_note.xlsx', (ws) => {
  ws.addRow(['○○盤 部品変更表（Rev.B）'])
  ws.addRow(['品名', '型式（旧）', '型式（新）', '数量', '変更内容', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, '型式変更（廃番のため）', '盤内上段'])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '削除', '盤内下段'])
  ws.addRow(['ランプ', 'L-1', '', 2, '削除（確認済）', ''])
  ws.addRow(['ソケット', 'PYF14A', '', 2, '削除（保留）', ''])
  ws.addRow(['ヒューズ', 'F-5A', '', 3, '削除（客先回答待ち）', ''])
  ws.addRow(['端子台', 'XW2B-20G4', '', 4, '', ''])
  ws.addRow(['電線', 'VCTF 2sq', '', 10, '', '削除（pending）'])
  ws.addRow(['ブザー', 'M2BJ', '', 1, '', '全て削除'])
  ws.addRow(['センサ', 'E3Z', '', 1, '', 'この部品は削除'])
})
// g2: 変更タイプ（結合した削除）／Action
await book('g2_change_type_merged.xlsx', (ws) => {
  ws.addRow(['変更タイプ', '品名', '型式（旧）', '型式（新）', '数量'])
  ws.addRow(['変更', 'リレー', 'MY2N', 'MY4N-D2', 4])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', '', 1])
  ws.addRow(['', 'ランプ', 'L-1', '', 2])
  ws.addRow(['', 'ソケット', 'PYF14A', '', 2])
  ws.mergeCells('A3:A5')
  ws.addRow(['追加', '端子台', '', 'XW2B-20G4', 4])
  ws.addRow(['', 'ヒューズ', 'F-5A', '', 3])
})
await book('g2b_action.xlsx', (ws) => {
  ws.addRow(['Action', '品名', '型式（旧）', '型式（新）', '数量'])
  ws.addRow(['Change', 'リレー', 'MY2N', 'MY4N-D2', 4])
  ws.addRow(['Remove', 'タイマ', 'H3CR-A8', '', 1])
  ws.addRow(['Add', '端子台', '', 'XW2B-20G4', 4])
  ws.addRow(['No change', 'ヒューズ', 'F-5A', '', 3])
})
// g3: EDA の BOM（KiCad 風）— DNP 列・Comment・Footprint
await book('g3_eda_dnp.xlsx', (ws) => {
  ws.addRow(['Reference', 'Value', 'Footprint', 'Qty', 'MPN', 'DNP', 'Note'])
  ws.addRow(['C1, C2, C3', '0.1uF', 'C_0603', 3, 'GRM188R71H104KA93D', '', ''])
  ws.addRow(['R1, R2', '10k', 'R_0603', 2, 'RK73B1JTTD103J', '', 'DNP 将来用'])
  ws.addRow(['R3', '4.7k', 'R_0603', 1, 'RK73B1JTTD472J', 'DNP', ''])
  ws.addRow(['U1', 'LM358', 'SOIC-8', 1, 'LM358DR', '', ''])
  ws.addRow(['J1', 'Conn_01x04', 'PinHeader', 1, 'B4B-XH-A', '', '(未実装)'])
  ws.addRow(['J2', 'USB-C', 'USB_C', 1, 'USB4110-GF-A', '', '※未実装'])
  ws.addRow(['D1', '1N4148W', 'SOD-123', 1, '1N4148W-7-F', '', 'DNP 製（大日本印刷）'])
})
// g4: ふつうの BOM（実在の型式・本物の備考）
await book('g4_ordinary_real.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', '単位', '備考'])
  const rows = [
    ['電磁リレー', 'MY4N-D2 DC24V', 'オムロン', 4, '個', '盤内上段。取付位置は図面参照'],
    ['ケーブル', 'DVI→HDMI', 'エレコム', 2, '本', '交換用 予備'],
    ['ケーブル', 'USB-A→USB-C', 'エレコム', 2, '本', '長さ変更可'],
    ['ダイオード', '1N4007 (>100V)', 'ON', 10, '個', ''],
    ['配管', 'PT1/4>φ6', 'SMC', 4, '個', '追加購入品'],
    ['ボルト', 'M4x10 (SUS304)', 'ミスミ', 100, '本', '取外し可能な構造'],
    ['スペーサ', 'SPW-5-10', 'ミスミ', 8, '個', '撤去スペース確保'],
    ['カバー', 'CV-100', 'ミスミ', 1, '個', '削除不要'],
    ['端子台', 'XW2B-20G4', 'オムロン', 4, '個', '前回の削除分を復活'],
    ['ヒューズ', '0217005.MXP', 'Littelfuse', 5, '個', 'DNP 製ではない'],
    ['LED', 'LTL-307EE', 'Lite-On', 10, '個', 'DNP'],
    ['IC', 'LM358 (SOIC-8)', 'TI', 2, '個', 'Not Fitted は 2 個目'],
  ]
  rows.forEach((r, i) => ws.addRow([i + 1, ...r]))
})
// g5: 支給品・社内在庫が備考／列にある
await book('g5_supplied_marks.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '調達区分', '備考'])
  ws.addRow(['PLC', 'FX5U-32MR/ES', '三菱電機', 1, '相見積', ''])
  ws.addRow(['モータ', 'MDMA-1', 'パナソニック', 2, '支給品', '客先支給'])
  ws.addRow(['端子台', 'XW2B-20G4', 'オムロン', 4, '社内在庫', '倉庫にあり'])
  ws.addRow(['ケーブル', 'KIV 2sq', '住電', 10, '相見積', '支給品ではない'])
})
console.log('xlsx done')
// テキスト
const t = (rows, d = '\t') => rows.map((r) => r.join(d)).join('\n') + '\n'
const H = ['品名', '型式（旧）', '型式（新）', 'メーカー', '数量', '備考']
const R = [
  ['リレー', 'MY2N', 'MY4N-D2', 'オムロン', '4', '盤内上段'],
  ['タイマ', 'H3CR-A8', '', 'オムロン', '1', '削除'],
  ['ランプ', 'L-1', '', 'IDEC', '2', '削除（確認済）'],
  ['ソケット', 'PYF14A', '', 'オムロン', '2', '削除（保留）'],
  ['端子台', 'XW2B-20G4', '', 'オムロン', '4', ''],
]
const titles = Array.from({ length: 7 }, (_, i) => `プロジェクト${i}: ○○盤, 担当: 山田, 日付: 2026/10/25`)
// h1: UTF-16LE (BOM) タブ区切り + コンマ入りの表題
fs.writeFileSync(D + 'h1_utf16_tsv_title_commas.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t([...titles.map((x) => [x]), H, ...R]).replace(/\n/g, '\r\n'), 'utf16le')]))
// h2: UTF-8 タブ区切り + 末尾の注記コンマ入り
fs.writeFileSync(D + 'h2_tsv_title_commas.tsv', t([...titles.map((x) => [x]), H, ...R]))
// h3: UTF-8 CSV でセルにタブ（複数行・引用符）
const q = (c) => (/[",\n\t]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
fs.writeFileSync(D + 'h3_csv_tab_in_cells.csv', '﻿' + [H, ['リレー', 'MY2N', 'MY4N-D2', 'オムロン', '4', '盤内上段\t左側'], ['タイマ', 'H3CR-A8', '', 'オムロン', '1', '削除'], ['端子台', 'XW2B-20G4', '', 'オムロン', '4', '']].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n')
