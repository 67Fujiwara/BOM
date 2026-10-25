// ラウンド21: 新人の手元の BOM その 9（ラウンド20 の直しの周り）→ files21/
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const D = '/home/user/BOM/usertest/newbie/r23/files21/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build, sheet = '部品表') { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// f1: 変更内容 + 備考 の両方がある変更図（削除は変更内容に書く）
await book('f1_change_content_and_note.xlsx', (ws) => {
  ws.addRow(['○○盤 部品変更表', '', '', '', '', ''])
  ws.mergeCells('A1:F1')
  ws.addRow(['品名', '型式（旧）', '型式（新）', '数量', '変更内容', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, '型式変更（廃番）', '盤内上段'])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '削除', '盤内下段'])
  ws.addRow(['端子台', 'XW2B-20G4', '', 4, '', ''])
  ws.addRow(['ランプ', 'L-1', '', 2, '削除', ''])
})
// f2: 改訂区分（縦に結合した「削除」と〃）
await book('f2_kaitei_kubun_merged_ditto.xlsx', (ws) => {
  ws.addRow(['ECN-2026-020 改訂表'])
  ws.addRow(['改訂区分', '品名', '型式（旧）', '型式（新）', '数量'])
  ws.addRow(['変更', 'リレー', 'MY2N', 'MY4N-D2', 4])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', '', 1])
  ws.addRow(['〃', 'ランプ', 'L-1', '', 2])
  ws.addRow(['〃', 'ソケット', 'PYF14A', '', 2])
  ws.addRow(['追加', '端子台', '', 'XW2B-20G4', 4])
  ws.addRow(['', '電線', 'VCTF 2sq', '', 10])
})
// f3: 書き写し＋「－」「そのまま」「No change」の混在（聞かれるか）
await book('f3_copy_and_marks.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', 'メーカー', '数量（旧）', '数量（新）'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 4, 4])
  ws.addRow(['タイマ', 'H3CR-A8', 'そのまま', 'オムロン', 1, 'そのまま'])
  ws.addRow(['端子台', 'XW2B-20G4', 'No change', 'オムロン', 4, 'No change'])
  ws.addRow(['ランプ', 'L-1', '－', 'IDEC', 2, '－'])
  ws.addRow(['ソケット', 'PYF14A', 'PYF14A', 'オムロン', 2, 2])
  ws.addRow(['ヒューズ', 'F-5A', '', 'ミスミ', 3, ''])
  ws.addRow(['電線', 'VCTF 2sq', 'VCTF 2sq', '住電', 10, 10])
})
// f4: 表題欄の製作台数 + Unit1/Unit2 + 合計の行
await book('f4_unit_columns_title.xlsx', (ws) => {
  ws.addRow(['盤名', '制御盤B', '', '製作台数', 2])
  ws.addRow([])
  ws.addRow(['品名', '型式', 'メーカー', 'Unit1', 'Unit2'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1])
  ws.addRow(['合計', '', '', 3, 3])
})
await book('f4b_daigo_columns.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '第1号機', '第2号機', '予備'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 1])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 0])
})
// f8: ふつうの BOM（旧／新なし）。型式に記号、備考に削除・撤去・DNP など
await book('f8_ordinary_real.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', '単位', '備考'])
  ws.addRow([1, '電磁リレー', 'MY4N-D2 DC24V', 'オムロン', 4, '個', '盤内上段'])
  ws.addRow([2, 'ケーブル', 'DVI→HDMI', 'エレコム', 2, '本', ''])
  ws.addRow([3, 'ケーブル', 'USB-A→USB-C 変換ケーブル', 'エレコム', 2, '本', ''])
  ws.addRow([4, '電線', 'UL1007 AWG22 (赤→黒)', '住電', 10, 'm', ''])
  ws.addRow([5, 'ダイオード', '1N4007 (>100V)', 'ON', 10, '個', ''])
  ws.addRow([6, 'タイマ', 'H3CR-A8', 'オムロン', 1, '個', '削除予定'])
  ws.addRow([7, 'ランプ', 'AL6M-M4 (赤)', 'IDEC', 2, '個', '削除に変更'])
  ws.addRow([8, 'フィルム', 'DNP 反射フィルム RF-200', 'ミスミ', 2, '枚', ''])
  ws.addRow([9, 'ヒューズ', 'F-5A', 'ミスミ', 3, '個', 'DNP 将来用'])
})
// f9: 変更区分の値いろいろ
await book('f9_kind_values.xlsx', (ws) => {
  ws.addRow(['変更区分', '品名', '型式（旧）', '型式（新）', '数量'])
  ws.addRow(['変更', 'リレー', 'MY2N', 'MY4N-D2', 4])
  ws.addRow(['取外し', 'タイマ', 'H3CR-A8', '', 1])
  ws.addRow(['廃番', 'ランプ', 'L-1', '', 2])
  ws.addRow(['削除(R012へ)', 'ソケット', 'PYF14A', '', 2])
  ws.addRow(['x', 'ヒューズ', 'F-5A', '', 3])
  ws.addRow(['削除済', 'スイッチ', 'A22-10M', '', 2])
  ws.addRow(['変更なし', '端子台', 'XW2B-20G4', '', 4])
})
// CSV 類
const csv = (name, s, enc = 'utf8') => { if (enc === 'utf8') fs.writeFileSync(D + name, s); else if (enc === 'bom') fs.writeFileSync(D + name, '﻿' + s); else { fs.writeFileSync(D + name + '.tmp', s); execSync(`iconv -f UTF-8 -t CP932 ${D}${name}.tmp > ${D}${name}; rm ${D}${name}.tmp`) } }
csv('c1_excel_tab_in_cell.csv', ['品名,型式,メーカー,数量,備考', 'リレー,MY4N-D2,オムロン,4,"盤内\t上段"', 'タイマ,H3CR-A8,オムロン,1,', 'ランプ,L-1,IDEC,2,', 'ソケット,PYF14A,オムロン,2,', 'ヒューズ,F-5A,ミスミ,3,'].join('\r\n') + '\r\n', 'bom')
csv('c2_multiline_and_comma_quoted.csv', ['品名,型式,メーカー,数量,備考', 'リレー,MY4N-D2,"Omron, Inc.",4,"1行目', '2行目"', 'タイマ,H3CR-A8,"Omron, Inc.",1,', 'ランプ,L-1,IDEC,2,"a, b', 'c, d, e"', 'ソケット,PYF14A,"Omron, Inc.",2,'].join('\r\n') + '\r\n', 'bom')
csv('c3_sjis_halfkana_total.csv', ['ﾋﾝﾒｲ,ｶﾀｼｷ,ﾒｰｶｰ,ｽｳﾘﾖｳ', 'ﾘﾚｰ,MY4N-D2,ｵﾑﾛﾝ,4', 'ﾀｲﾏ,H3CR-A8,ｵﾑﾛﾝ,1', 'ｺﾞｳｹｲ,,,5'].join('\r\n') + '\r\n', 'sjis')
csv('c4_title_comma.csv', ['○○盤 部品表,,,', '作成: 山田,2026-10-01,,', ',,,', '品名,型式,メーカー,数量', 'リレー,MY4N-D2,オムロン,4', 'タイマ,H3CR-A8,オムロン,1'].join('\r\n') + '\r\n', 'bom')
console.log(fs.readdirSync(D).join(' '))
