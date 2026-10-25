// ラウンド23: 新人の手元の BOM その 11（ラウンド22 の直しの周り）→ files23/
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const D = '/home/user/BOM/usertest/newbie/r23/files23/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build, sheet = '部品表') { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// f1: 変更図：備考の括弧（保留＋理由の混ぜ書き）、使っていない、全て削除でお願いします
await book('f1_change_notes_mixed.xlsx', (ws) => {
  ws.addRow(['○○盤 部品変更表（Rev.C）', '', '', '', '', ''])
  ws.addRow(['作成: 山田', '日付: 2026/10/20', '', '', '', ''])
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, '型式変更'])
  ws.addRow(['タイマ', 'H3CR-A8', '', 'オムロン', 1, '削除（確認中のため）'])
  ws.addRow(['ランプ', 'PL-24', '', 'IDEC', 2, '削除（使用していない）'])
  ws.addRow(['ソケット', 'PYF14A', '', 'オムロン', 2, '削除（客先確認中のため保留）'])
  ws.addRow(['ヒューズ', 'F-5A', '', 'ミスミ', 3, '全て削除でお願いします'])
  ws.addRow(['ブザー', 'BZ-1', '', 'IDEC', 1, '削除（Review待ち）'])
  ws.addRow(['センサ', 'E3Z', '', 'オムロン', 1, '承認後は削除'])
  ws.addRow(['端子台', 'XW2B-20G4', '', 'オムロン', 4, ''])
  ws.addRow(['電線', 'VCTF 2sq', '', '住電', 10, '削除（確認済）'])
  ws.addRow(['押釦', 'A22-10M', '', 'オムロン', 2, '削除（保留）'])
  ws.addRow(['合計', '', '', '', 26, ''])
})
// f2: 更新区分（はっきり）に語彙外／ステータス（あいまい）
await book('f2_kind_update.xlsx', (ws) => {
  ws.addRow(['更新区分', '品名', '型式（旧）', '型式（新）', '数量'])
  ws.addRow(['型式変更', 'リレー', 'MY2N', 'MY4N-D2', 4])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', '', 1])
  ws.addRow(['追加', '端子台', '', 'XW2B-20G4', 4])
  ws.addRow(['据え置き', 'ヒューズ', 'F-5A', 'F-5A', 3])
  ws.addRow(['数量変更', '電線', 'VCTF', 'VCTF', 12])
})
await book('f3_status_ordinary.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', 'ステータス', '備考'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, '新規', ''])
  ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 1, '継続', 'DVI→HDMI 変換用'])
  ws.addRow([3, '変換ケーブル', 'DVI→HDMI', 'サンワ', 1, '継続', '代替品あり'])
  ws.addRow([4, 'ヒューズ', 'F-5A', 'ミスミ', 3, '廃止', '在庫のみ'])
  ws.addRow([5, '端子台', 'XW2B-20G4', 'オムロン', 4, '新規', ''])
})
// f4: 旧→新 見出し
await book('f4_arrow_header.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧→新）', 'メーカー', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N→MY4N-D2', 'オムロン', 4, ''])
  ws.addRow(['タイマ', 'H3CR-A7→H3CR-A8', 'オムロン', 1, '位置変更あり'])
  ws.addRow(['ケーブル', 'USB-A→USB-C', 'サンワ', 1, 'R12に置換'])
  ws.addRow(['端子台', 'XW2B-20G4', 'オムロン', 4, ''])
})
// f5: EDA ＋ DNP 備考 ＋ メーカ DNP
await book('f5_eda_dnp_notes.xlsx', (ws) => {
  ws.addRow(['Reference', 'Value', 'Footprint', 'Qty', 'Note'])
  ws.addRow(['R1,R2', '10k', '0603', 2, ''])
  ws.addRow(['C1', '100n', '0603', 1, 'DNP（大日本印刷）'])
  ws.addRow(['C2', '10u', '0805', 1, 'DNP 将来用'])
  ws.addRow(['U1', 'NE555', 'SOIC-8', 1, 'DNP未納'])
  ws.addRow(['J1', 'FH12-10S', 'FPC', 1, 'DNP品'])
  ws.addRow(['J2', 'FH12-12S', 'FPC', 1, '実装しません'])
  ws.addRow(['D1', '1N4148', 'SOD-123', 2, 'DNP、将来用'])
})
// f6: 結合セルの変更区分＋空欄＋〃
await book('f6_merged_sparse.xlsx', (ws) => {
  ws.addRow(['変更区分', '品名', '型式（旧）', '型式（新）', '数量', '備考'])
  ws.addRow(['変更', 'リレー', 'MY2N', 'MY4N-D2', 4, ''])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', '', 1, ''])
  ws.addRow(['', 'ランプ', 'PL-24', '', 2, ''])
  ws.addRow(['', 'ソケット', 'PYF14A', '', 2, '削除（保留）'])
  ws.mergeCells('A3:A5')
  ws.addRow(['追加', '端子台', '', 'XW2B-20G4', 4, ''])
  ws.addRow(['〃', 'ヒューズ', '', 'F-5A', 3, ''])
})
// f7: 変更の列が「Change」で ○ だけ、削除は別の備考
await book('f7_change_circle.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', '数量', 'Change', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, '○', ''])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '', '削除'])
  ws.addRow(['ヒューズ', 'F-5A', 'F-5A', 3, '', ''])
  ws.addRow(['端子台', 'XW2B-20G4', 'XW2B-20G4', 4, '', ''])
})
// h: CSV Shift_JIS ＋ 表題コンマ ＋ 区切りの選び方
const csvSj = (name, text) => { fs.writeFileSync(D + name + '.tmp', text); execSync(`iconv -f UTF-8 -t CP932 ${D}${name}.tmp > ${D}${name}; rm ${D}${name}.tmp`) }
csvSj('h1_sjis_title_commas.csv', ['案件名: ○○盤, 客先: ABC, 担当: 山田', '日付: 2026/10/20, Rev: C, 備考なし', '品名,型式（旧）,型式（新）,メーカー,数量,備考', 'リレー,MY2N,MY4N-D2,オムロン,4,', 'タイマ,H3CR-A8,,オムロン,1,削除（確認中のため）', 'ヒューズ,F-5A,,ミスミ,3,削除（使用していない）', '端子台,XW2B-20G4,,オムロン,4,'].join('\r\n'))
fs.writeFileSync(D + 'h2_tsv_commas_titles.txt', [...Array.from({ length: 8 }, (_, i) => `案件${i}: ○○盤, 客先: ABC, 担当: 山田, 日付: 2026/10/20, 備考なし`), '品名\t型式\tメーカー\t数量', 'リレー\tMY4N-D2\tオムロン\t4', 'タイマ\tH3CR-A8\tオムロン\t1', 'ヒューズ\tF-5A\tミスミ\t3'].join('\n'))
console.log('done')
