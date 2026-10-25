// ラウンド18: 300 行のファイル（132-big18.mjs と 132b-big18-direct.ts が使う）。dl/c*-*.{csv,xlsx,tsv}
// c1 .csv（Excel の書き出し）備考の複数行のセルの中にコンマ（"盤内上段, 左側\n(要確認)"）を 10 行ごと（30 か所）
// c2 タブ区切り（Excel からのコピー）部品名のセルの最後に改行（"リレーk\n"）を 15 行ごと（20 か所）
// c3 .xlsx KiCad / EDA の BOM「Reference・Value・Footprint・Qty・Description・Manufacturer・MPN」300 行
// c4 .xlsx 変えた行だけ書く変更表 300 行: 変更 30 行、変えない行のうち 30 行に備考「取外し不要」
// c5 .xlsx 書き写す変更表 300 行のうち、書き写し 60・変更 20・削除（変更後が空）100・残り 120 も書き写し…ではなく、書き写し 80・変更 20・削除 200（オプションのユニットを外した）
// c6 .xlsx「必要数・手配数」（手配数は 10 個単位に丸めた数）300 行
// c7 .xlsx 機構部品表 300 行で 20 行ごとにメーカ「DNP」（大日本印刷の銘板・フィルム）
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const DL = '/home/user/BOM/usertest/veteran/r18/dl/'
const N = 300
const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const c1 = [['部品名', '型式', 'メーカ', '数量', '備考'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [`部品${k}`, `M-${k}`, 'オムロン', String(k % 7 + 1), k % 10 === 0 ? '盤内上段, 左側\n(要確認)' : ''] })]
fs.writeFileSync(DL + 'c1-csv-excel-multiline-comma-300.csv', c1.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n')
const c2 = [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [k % 15 === 0 ? `"リレー${k}\n"` : `リレー${k}`, `M-${k}`, 'オムロン', String(k % 7 + 1)] })]
fs.writeFileSync(DL + 'c2-tsv-trailing-newline-300.tsv', c2.map((r) => r.join('\t')).join('\n') + '\n')
async function wb(name, rows) { const w = new ExcelJS.Workbook(); const s = w.addWorksheet('BOM'); for (const r of rows) s.addRow(r); await w.xlsx.writeFile(DL + name) }
const kinds = [['Capacitor', '10uF', 'C_0603', 'Murata', 'GRM188R61A106'], ['Resistor', '10k', 'R_0603', 'Yageo', 'RC0603FR-0710KL'], ['Diode', '1N4148', 'D_SOD123', 'Nexperia', '1N4148W'], ['LED', 'Red', 'LED_0603', 'Rohm', 'SML-D12U8W']]
await wb('c3-eda-value-description-300.xlsx', [['Reference', 'Value', 'Footprint', 'Qty', 'Description', 'Manufacturer', 'MPN'], ...Array.from({ length: N }, (_, i) => { const k = kinds[i % 4]; return [`${k[0][0]}${i + 1}`, k[1], k[2], (i % 5) + 1, k[0], k[3], `${k[4]}-${i + 1}`] })])
await wb('c4-sparse-note-torihazushi-fuyou-300.xlsx', [['部品名', '型式', '変更後型式', '数量', '備考'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [`部品${k}`, `OLD-${k}`, k % 10 === 1 ? `NEW-${k}` : '', (k % 7) + 1, k % 10 === 5 ? '取外し不要' : ''] })])
await wb('c5-copy-unit-removed-300.xlsx', [['部品名', '型式', '変更後型式', '数量'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [`部品${k}`, `OLD-${k}`, k <= 80 ? `OLD-${k}` : k <= 100 ? `NEW-${k}` : '', (k % 7) + 1] })])
await wb('c6-need-and-order-300.xlsx', [['部品名', '型式', 'メーカ', '必要数', '手配数'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; const need = (k % 7) + 1; return [`部品${k}`, `M-${k}`, 'オムロン', need, Math.ceil(need / 10) * 10] })])
await wb('c7-maker-dnp-300.xlsx', [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return k % 20 === 0 ? [`銘板${k}`, `NP-${k}`, 'DNP', 1] : [`部品${k}`, `M-${k}`, 'オムロン', (k % 7) + 1] })])
console.log('ok', fs.readdirSync(DL).filter((f) => /^c\d-/.test(f)))
