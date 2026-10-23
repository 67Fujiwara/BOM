// ラウンド13: 新人の手元にありがちな「汚い」BOM（版の印の別の書き方・字間の空白・全角の数字・2 段の見出しの別形・シフトJIS CSV など）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const D = '/home/user/BOM/usertest/newbie/r15/files13/'
fs.mkdirSync(D, { recursive: true })
const head = ['No', '品名', '型式', 'メーカー', '数量']
async function book(name, build) { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('部品表'); build(ws, wb); await wb.xlsx.writeFile(D + name) }
const R1 = ['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]
const R2 = ['タイマ', 'H3Y-2', 'H3CR-A8', 'オムロン', 1, 3]
// m1: 版の印の別の書き方（修正前/修正後・改定前/改定後・改正前/改正後・訂正前/訂正後・Rev.A/Rev.B・今回/前回・旧→新 の矢印 など）
const pairs = [
  ['型式 修正前', '型式 修正後', '数量 修正前', '数量 修正後'],
  ['改定前型式', '改定後型式', '改定前数量', '改定後数量'],
  ['改正前型式', '改正後型式', '改正前数量', '改正後数量'],
  ['型式（訂正前）', '型式（訂正後）', '数量（訂正前）', '数量（訂正後）'],
  ['型式 Rev.A', '型式 Rev.B', '数量 Rev.A', '数量 Rev.B'],
  ['前回型式', '今回型式', '前回数量', '今回数量'],
  ['型式(変更前)', '型式(変更後)', '数量', '変更後数量'],
  ['旧品番', '新品番', '旧数量', '新数量'],
  ['型式 差替前', '型式 差替後', '数量 差替前', '数量 差替後'],
  ['型式（現状）', '型式（変更案）', '数量（現状）', '数量（変更案）'],
]
for (const [i, [a, b, c, d]] of pairs.entries()) await book(`m1_${String(i + 1).padStart(2, '0')}_ver.xlsx`, (ws) => { ws.addRow(['品名', a, b, 'メーカー', c, d]); ws.addRow(R1); ws.addRow(R2) })
// m2: 字間に空白のある見出し（品　名・型　式・数　量）
await book('m2_spaced_header.xlsx', (ws) => { ws.addRow(['No', '品　名', '型　式', 'メーカー', '数　量']); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]) })
await book('m2b_spaced_header_half.xlsx', (ws) => { ws.addRow(['No', '品 名', '型 式', 'メ ー カ', '員 数']); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2]) })
// m3: 2 段の見出しの別形（上の段が「部品情報」「数量」のグループ、下の段に 品名・型式・メーカー・旧・新）
await book('m3_group_tier.xlsx', (ws) => {
  ws.addRow(['部品情報', '', '', '数量', '']); ws.addRow(['品名', '型式', 'メーカー', '旧', '新'])
  ws.mergeCells('A1:C1'); ws.mergeCells('D1:E1')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 3])
})
// m3b: 2 段の見出しで下の段に「旧／新」と単位「(個)」も
await book('m3b_tier_with_unit.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', '', 'メーカー', '数量', '']); ws.addRow(['', '', '旧', '新', '', '旧', '新（個）'])
  ws.mergeCells('C1:D1'); ws.mergeCells('F1:G1')
  ws.addRow([1, 'リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4]); ws.addRow([2, 'タイマ', 'H3Y-2', 'H3CR-A8', 'オムロン', 1, 3])
})
// m3c: 2 段の見出しで下の段が「現行」「変更」、上の段が「型式」「数量」で結合なし（右のセルは空）
await book('m3c_tier_genkou_henkou.xlsx', (ws) => {
  ws.addRow(['品名', '型式', '', 'メーカー', '数量', '']); ws.addRow(['', '現行', '変更', '', '現行', '変更'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 'オムロン', 2, 4])
})
// m4: ページの印の全角・別の書き方
await book('m4_pagemarks_zen.xlsx', (ws) => {
  let n = 1
  const marks = [['', '－２－'], ['', 'P1/3'], ['', '以下次頁'], ['', '次頁につづく'], ['', '（２／３）'], ['', '２ページ'], ['', '-以下次葉-']]
  ws.addRow(head)
  for (const m of marks) { ws.addRow([n, `部品${n}`, `M-${n}`, 'オムロン', n]); n++; ws.addRow([m[0], m[1], '', '', '']) }
  ws.addRow([n, `部品${n}`, `M-${n}`, 'オムロン', n])
})
// m5: 合計の書き方（全角・単位つき）
await book('m5_totals_more.xlsx', (ws) => {
  ws.addRow(['No', '品名', '型式', 'メーカー', '数量', '金額'])
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4, 8000])
  ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2, 4000])
  for (const t of ['合計 6台分', '部品点数合計 2', '計 ６', '合計：6個 / ¥12,000', '合計（盤A）', '総 計', '合計 6 ヶ', '以上 2 品目']) ws.addRow(['', t, '', '', 6, 12000])
})
// m6: 未定の行（型式未定・数量未定・TBD・メーカー未定）
await book('m6_mitei.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4])
  ws.addRow([2, 'ヒューズ', '未定', '未定', 2])
  ws.addRow([3, '端子台', 'TBD', 'IDEC', '未定'])
  ws.addRow([4, '（未定）', '', '', ''])
  ws.addRow([5, 'ケーブル', 'VCTF 0.75sq', '', '20m'])
})
// m7: 3 シート（盤A・盤B・盤A(旧)）
{
  const wb = new ExcelJS.Workbook()
  const a0 = wb.addWorksheet('盤A(旧)'); a0.addRow(head); a0.addRow([1, 'リレー', 'MY2N', 'オムロン', 2])
  const a = wb.addWorksheet('盤A'); a.addRow(head); a.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4])
  const b = wb.addWorksheet('盤B'); b.addRow(head); b.addRow([1, 'ブレーカ', 'NF32-SV', '三菱電機', 2]); b.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 3])
  await wb.xlsx.writeFile(D + 'm7_three_sheets.xlsx')
}
// m8: シフトJIS の CSV（Excel の「CSV（コンマ区切り）」の既定）。数量に「4個」「２」全角
fs.writeFileSync(D + 'm8_sjis.csv', execFileSync('python3', ['-c', 'import sys;sys.stdout.buffer.write(sys.stdin.read().encode("cp932"))'], { input: '品名,型式,メーカー,数量,備考\r\nリレー,MY4N-D2,オムロン,4個,\r\nタイマ,H3CR-A8,オムロン,２,"制御盤,扉"\r\nケーブル,VCTF 0.75sq,,20m,\r\n' }))
// m9: UTF-16LE のタブ区切り（Excel の Unicode テキスト）、旧/新の印つき 2 段の見出し
{
  const t = 'No\t品名\t型式\t\tメーカー\t数量\t\r\n\t\t旧\t新\t\t旧\t新\r\n1\tリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4\r\n'
  fs.writeFileSync(D + 'm9_utf16_twotier.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, 'utf16le')]))
}
// m10: ページごとの見出しの繰り返しで、2 ページ目の見出しが字間空白・「数量（個）」と違う
await book('m10_repeat_variant.xlsx', (ws) => {
  ws.addRow(['制御盤A 部品表', '', '', '', '1/2'])
  ws.addRow(head); ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', 4]); ws.addRow([2, 'タイマ', 'H3CR-A8', 'オムロン', 2])
  ws.addRow(['制御盤A 部品表', '', '', '', '2/2'])
  ws.addRow(['No.', '品　名', '型　式', 'メーカ', '数量（個）']); ws.addRow([3, 'ブレーカ', 'NF32-SV', '三菱電機', 1])
})
// m11: 数量の書き方いろいろ（xlsx 文字）
await book('m11_qty_forms.xlsx', (ws) => {
  ws.addRow(head)
  const q = ['4個', '２', '4 pcs', '1式', '-', '1,000', '4+2', '0.5m', '３本', '十二']
  q.forEach((x, i) => ws.addRow([i + 1, `部品${i + 1}`, `Q-${i + 1}`, 'オムロン', x]))
})
// m12: 数式（計算結果あり）・ハイパーリンク・リッチテキスト・日付っぽい型式
await book('m12_cell_kinds.xlsx', (ws) => {
  ws.addRow(head)
  ws.addRow([1, 'リレー', 'MY4N-D2', 'オムロン', { formula: '2*2', result: 4 }])
  ws.addRow([2, { richText: [{ text: 'タイ' }, { text: 'マ', font: { bold: true } }] }, 'H3CR-A8', 'オムロン', 2])
  ws.addRow([3, 'コネクタ', '1-1', 'TE', 3])
  ws.addRow([4, 'ダイオード', '1N4148', 'onsemi', 10])
  ws.addRow([5, '抵抗', '=RES-10K', 'KOA', 5])
})
console.log('ok')
