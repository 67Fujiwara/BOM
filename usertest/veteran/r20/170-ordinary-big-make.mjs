// ラウンド20: 普通の BOM（変更表でない）2,500 行の .xlsx / .csv / .tsv を作る（乱数。意図して変えた語を除いた語彙）。dl/o1-*.{xlsx,csv,tsv}
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const DL = '/home/user/BOM/usertest/veteran/r20/dl/'
let s = 20261025 >>> 0
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const NAMES = ['抵抗', 'コンデンサ', 'リレー', '端子台', '電磁接触器', 'ブレーカ', '表示灯', 'ケーブル', 'ターミナル, 2極', '取外し工具', '撤去用ブラケット', '未実装基板', 'ＤＩＮレール', 'パイプ 3/4"', 'ヒューズホルダ', '押しボタン(赤)', 'タイマ', 'ファン', '"特注"品', '電源ユニット', 'LED 5mm', '削除用治具', '廃止品交換用', 'Del-Box', '欠番管理票', '中止灯', '不要物箱']
const MODELS = ['MY4N', 'MY4N-D2 DC24', 'XW2B-20G5', '1/2"-NPT', '0.5"x3"', 'PYF14A', 'H3CR-A8', 'NP-100', 'GRM188', 'RC0603-10K', 'A/B', '3.5" HDD', 'MS-N10', 'SC-N2 AC200V', 'CP-100', 'IDEC,HW1B', '-', '×', 'なし', 'N/A', '未定', 'TBD']
const MAKERS = ['オムロン', '三菱電機', '', 'IDEC', 'パナソニック', '〃', '同上', '"', '-', '－', '自社', 'ミスミ', 'Omron, Inc.', '社内製作', '支給品']
const NOTES = ['', '', '', '', '盤内', '取外し時注意', '削除不可', '削除予定', '撤去品流用', '変更なし', 'Rev.2', '要確認', '新規', '追加', '変更', '位置変更', '削除', '撤去済', '削除済', '取外し可能', '廃止予定', '2台目から', '〃', '同上', '"', '※注意\n（改行つき）', '色: 灰, 黒', '３／４"']
const hdr = ['部品名', '型式', 'メーカ', '数量', '単位', '回路記号', '備考']
const rows = []
for (let i = 1; i <= 2500; i++) rows.push([rnd() < 0.3 ? pick(NAMES) : `部品${i}`, rnd() < 0.5 ? pick(MODELS) : `M-${i}`, pick(MAKERS), pick(['1', '2', '4', '10', '100', '3個', '5 m', '１２', '2+1', '1.5']), pick(['個', '本', 'm', 'セット', '']), pick(['', 'R1', 'R1, R2, R3', 'C1-C4']), pick(NOTES)])
const all = [hdr, ...rows]
const q = (c, d) => (/["\n]/.test(c) || c.includes(d) ? '"' + c.replace(/"/g, '""') + '"' : c)
fs.writeFileSync(DL + 'o1-ordinary-2500.csv', all.map((r) => r.map((c) => q(c, ',')).join(',')).join('\r\n') + '\r\n')
fs.writeFileSync(DL + 'o1-ordinary-2500.tsv', all.map((r) => r.map((c) => q(c, '\t')).join('\t')).join('\r\n') + '\r\n')
const wb = new ExcelJS.Workbook(); const sh = wb.addWorksheet('BOM'); for (const r of all) sh.addRow(r); await wb.xlsx.writeFile(DL + 'o1-ordinary-2500.xlsx')
console.log('ok')
