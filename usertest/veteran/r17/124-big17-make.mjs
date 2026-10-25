// ラウンド17: 300 行の .csv / .xlsx / 貼り付けの文字（124-big17.mjs と 124b-big17-direct.ts が使う）。dl/b*-*.{csv,xlsx,tsv}
// b1 .csv（囲まずに書いた）メーカの「"」（上と同じ）を 10 行ごと（30 か所）
// b2 タブ区切り（Excel からのコピー）最後の列 備考 の「"」を k%10==5、次の行の最初の列 部品名 も「"」（k%10==6）
// b3 .xlsx 縦の表題欄（図番・品名・作成日・作成者＋値）の下に EDA の見出し 300 行
// b4 .xlsx 2 段「数量」の下「1号機・2号機・予備」300 行
// b5 .xlsx 全部の行に変更後を書き写した 4 行×75 ページ相当の小さな変更表…ではなく、3 行に 1 行が削除（変更後が空）の 30 行（全部書き写し）
// b6 .xlsx 変えた行だけ書く 30 行で 25 行を変えた（5 行は変えていない）
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const DL = '/home/user/BOM/usertest/veteran/r17/dl/'
const MK = ['オムロン', '三菱電機', 'IDEC']
const b1 = [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [`部品${k}`, `MDL-${k}`, k % 10 === 5 ? '"' : MK[k % 3], (k % 9) + 1] })]
fs.writeFileSync(DL + 'b1-csv-raw-ditto-every10-300.csv', b1.map((r) => r.join(',')).join('\r\n') + '\r\n')
const b2 = [['部品名', '型式', 'メーカ', '数量', '備考'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [k % 10 === 6 ? '"' : `部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1, k % 10 === 5 ? '"' : k % 10 === 4 ? '盤内' : ''] })]
fs.writeFileSync(DL + 'b2-tsv-ditto-last-first-300.tsv', b2.map((r) => r.join('\t')).join('\n'))
async function wb(name, rows, merge) { const w = new ExcelJS.Workbook(); const s = w.addWorksheet('BOM'); for (const r of rows) s.addRow(r); merge?.(s); await w.xlsx.writeFile(DL + name) }
const EDA = ['Capacitor', 'Resistor', 'Diode', 'Connector', 'Inductor']
await wb('b3-vtitle-eda-300.xlsx', [['図番', '品名', '作成日', '作成者'], ['D-123', '制御基板A', '2026-10-01', '山田'], [], ['Description', 'Value', 'MPN', 'Footprint', 'Qty', 'DNP'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [`${EDA[k % 5]} ${k}`, `${k}k`, `MPN-${k}`, '0603', (k % 9) + 1, k % 7 === 0 ? 'DNP' : ''] })])
await wb('b4-units-spare-300.xlsx', [['部品名', '型式', 'メーカ', '数量', '', ''], ['', '', '', '1号機', '2号機', '予備'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1, (k % 9) + 1, k % 5 === 0 ? 1 : 0] })], (s) => s.mergeCells('D1:F1'))
await wb('b5-complete-third-deleted-30.xlsx', [['部品名', '型式', '変更後型式', 'メーカ', '変更後メーカ', '数量'], ...Array.from({ length: 30 }, (_, i) => { const k = i + 1; const del = k % 3 === 0; return [`部品${k}`, `OLD-${k}`, del ? '' : k % 5 === 0 ? `NEW-${k}` : `OLD-${k}`, MK[k % 3], del ? '' : MK[k % 3], k] })])
await wb('b6-sparse-25-of-30.xlsx', [['部品名', '型式', '変更後型式', '数量'], ...Array.from({ length: 30 }, (_, i) => { const k = i + 1; return [`部品${k}`, `OLD-${k}`, k <= 25 ? `NEW-${k}` : '', k] })])
console.log('ok')
