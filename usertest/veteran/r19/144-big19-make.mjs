// ラウンド19: 300 行のファイル（144-big19.mjs と 144b-big19-direct.ts が使う）。dl/d*-*.{csv,xlsx,tsv}
// d1 .xlsx 書き写す変更表（型式 1 項目）300 行: 書き写し 170・変更 40・削除（変更後が空）90 → 期待 210 行
// d2 .xlsx 変えた行だけ書く変更表 300 行: 型式変更 30・取付位置変更（同じ型式を書いた）30・変えていない 240 行は「－」 → 期待 300 行
// d3 .csv 1 行目が表題（コンマなし）、メーカの「"」（上と同じ）を 10 行ごと（30 か所） → 期待 300 行
// d4 .xlsx 変えた行だけ書く変更表 300 行: 変更 30・変えていない行のうち 30 行に備考「取外し時注意」 → 期待 300 行
// d5 .xlsx 機構部品表 300 行で 20 行ごとに部品名「未実装基板」（基板だけ買う） → 期待 300 行
// d6 .xlsx 号機ごとの変更表「1号機(旧)・2号機(旧)・1号機(新)・2号機(新)」300 行: 変えた 30 行だけ新を書く → 期待 数量の合計＝旧の合計＋差
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const DL = '/home/user/BOM/usertest/veteran/r19/dl/'
const N = 300
async function wb(name, rows) { const w = new ExcelJS.Workbook(); const s = w.addWorksheet('BOM'); for (const r of rows) s.addRow(r); await w.xlsx.writeFile(DL + name) }
await wb('d1-copy-1field-170-40-90del-300.xlsx', [['部品名', '型式', '変更後型式', '数量'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [`部品${k}`, `OLD-${k}`, k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : '', (k % 7) + 1] })])
await wb('d2-sparse-dash-unchanged-300.xlsx', [['部品名', '型式', '変更後型式', '数量', '備考'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return k % 10 === 1 ? [`部品${k}`, `OLD-${k}`, `NEW-${k}`, (k % 7) + 1, '型式変更'] : k % 10 === 2 ? [`部品${k}`, `OLD-${k}`, `OLD-${k}`, (k % 7) + 1, '取付位置変更'] : [`部品${k}`, `OLD-${k}`, '－', (k % 7) + 1, ''] })])
const d3 = ['部品表 制御盤A 2026-10-25', '部品名,型式,メーカ,数量', ...Array.from({ length: N }, (_, i) => { const k = i + 1; return `部品${k},M-${k},${k % 10 === 0 ? '"' : 'オムロン'},${(k % 7) + 1}` })]
fs.writeFileSync(DL + 'd3-csv-titleline-ditto-300.csv', d3.join('\n') + '\n')
await wb('d4-sparse-note-torihazushi-chuui-300.xlsx', [['部品名', '型式', '変更後型式', '数量', '備考'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return [`部品${k}`, `OLD-${k}`, k % 10 === 1 ? `NEW-${k}` : '', (k % 7) + 1, k % 10 === 5 ? '取外し時注意' : ''] })])
await wb('d5-mijissou-kiban-name-300.xlsx', [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; return k % 20 === 0 ? ['未実装基板', `PCB-${k}`, '自社', 1] : [`部品${k}`, `M-${k}`, 'オムロン', (k % 7) + 1] })])
await wb('d6-machine-sparse-300.xlsx', [['部品名', '型式', '1号機(旧)', '2号機(旧)', '1号機(新)', '2号機(新)'], ...Array.from({ length: N }, (_, i) => { const k = i + 1; const q = (k % 3) + 1; return k % 10 === 1 ? [`部品${k}`, `M-${k}`, q, q, q + 1, q + 1] : [`部品${k}`, `M-${k}`, q, q, '', ''] })])
console.log('ok', fs.readdirSync(DL).filter((f) => /^d\d-/.test(f)))
