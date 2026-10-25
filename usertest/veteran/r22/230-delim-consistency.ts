// ラウンド22: ラウンド21 の区切りの決め方（タブとコンマの両方で parseTable し、「列の数の最頻値 × その行数」が大きいほう）を攻める。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const T = (r: string[]) => r.join('\t'), C = (r: string[]) => r.join(',')
const refs = (n: number, k: number) => Array.from({ length: k }, (_, i) => `R${n * 10 + i}`).join(', ')
type K = { id: string; note: string; text: string; expectDelim: string; expectRows: number }
const cases: K[] = []
const add = (id: string, note: string, text: string, expectDelim: string, expectRows: number) => cases.push({ id, note, text, expectDelim, expectRows })
for (const k of [1, 2, 3, 4, 5, 6, 8, 12]) {
  add(`D01-tsv4-refs${k}`, `TSV 4 列（部品名・型式・員数・回路記号）。回路記号に「R1, R2, …」コンマ ${k} 個 全行`, ['部品名\t型式\t員数\t回路記号', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, '1', refs(i, k + 1)]))].join('\n'), 'tab', 10)
  add(`D02-tsv3-note${k}`, `TSV 3 列（部品名・型式・備考）。備考にコンマ ${k} 個 全行`, ['部品名\t型式\t備考', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, Array.from({ length: k + 1 }, (_, j) => '項目' + j).join(', ')]))].join('\n'), 'tab', 10)
  add(`D03-tsv5-half${k}`, `TSV 5 列。半分の行の備考にコンマ ${k} 個`, ['部品名\t型式\tメーカ\t数量\t備考', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, 'オムロン', '1', i % 2 ? Array.from({ length: k + 1 }, (_, j) => '項目' + j).join(', ') : '']))].join('\n'), 'tab', 10)
}
add('D04-tsv2-comma', 'TSV 2 列（部品名・型式）、部品名に「抵抗, 1kΩ」', ['部品名\t型式', ...Array.from({ length: 8 }, (_, i) => T([`抵抗, ${i}kΩ, 1/4W`, `M-${i}`]))].join('\n'), 'tab', 8)
add('D05-tsv3-maker-comma', 'TSV 3 列、メーカ「Omron, Inc.」と部品名にコンマ', ['部品名\t型式\tメーカ', ...Array.from({ length: 8 }, (_, i) => T([`抵抗, ${i}kΩ, 1/4W, 5%`, `M-${i}`, 'Omron, Inc.']))].join('\n'), 'tab', 8)
add('D06-csv-tab-notes', 'CSV 5 列、備考に「盤内\\t上段\\t左」（タブ 2 つ）全行', ['部品名,型式,メーカ,数量,備考', ...Array.from({ length: 10 }, (_, i) => C([`部品${i}`, `M-${i}`, 'オムロン', '1', '盤内\t上段\t左']))].join('\n'), 'comma', 10)
add('D07-csv-tab-notes-5', 'CSV 3 列、備考にタブ 5 つ全行', ['部品名,型式,備考', ...Array.from({ length: 10 }, (_, i) => C([`部品${i}`, `M-${i}`, 'a\tb\tc\td\te\tf']))].join('\n'), 'comma', 10)
add('D08-csv-quoted-tab-notes', 'CSV（Excel）3 列、備考「"a\\tb\\tc\\td"」囲みあり', ['部品名,型式,備考', ...Array.from({ length: 10 }, (_, i) => C([`部品${i}`, `M-${i}`, '"a\tb\tc\td"']))].join('\n'), 'comma', 10)
add('D09-single-col-comma', '1 列（部品名だけ）にコンマ入り', ['部品名', ...Array.from({ length: 6 }, (_, i) => `ターミナル, ${i}極`)].join('\n'), 'comma', 6)
add('D10-single-col-tab-comma', '1 列にタブ 1 つ（行末）とコンマ', ['部品名', ...Array.from({ length: 6 }, (_, i) => `ターミナル, ${i}極\t`)].join('\n'), 'tab', 6)
add('D11-ragged-tsv', 'TSV: 行ごとに列の数がばらばら（4・5・6・4・5・6 …）、コンマ入り', ['部品名\t型式\t数量\t備考', ...Array.from({ length: 12 }, (_, i) => T([`部品${i}`, `M-${i}`, '1', 'a, b', ...Array(i % 3).fill('x')]))].join('\n'), 'tab', 12)
add('D12-tsv-ref-formula', 'TSV 4 列で、型式にコンマ 1 つ・備考にコンマ 2 つ（タブ 3 = コンマ 3）', ['部品名\t型式\t員数\t備考', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M, ${i}`, '1', 'a, b, c']))].join('\n'), 'tab', 10)
add('D13-tsv-eq-tie', 'TSV 3 列で全行コンマ 2 つ（同点）', ['部品名\t型式\t備考', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, 'a, b, c']))].join('\n'), 'tab', 10)
add('D14-tsv-multiline-ref', 'TSV 4 列。回路記号が引用符つきの複数行「"R1,\\nR2,\\nR3"」', ['部品名\t型式\t員数\t回路記号', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, '3', '"R1, R2,\nR3, R4,\nR5, R6"']))].join('\n'), 'tab', 10)
add('D15-tsv-title-commas', 'TSV: 表題（コンマだらけ）3 行＋見出し＋10 行（回路記号コンマ 4）', ['部品表, 制御盤A, 2026-10-25, Rev.2, 山田', '客先, X商事, 納期, 12月, 急ぎ', 'メモ, a, b, c, d', 'x', '部品名\t型式\t員数\t回路記号', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, '1', refs(i, 5)]))].join('\n'), 'tab', 10)
add('D16-tsv-big-comma-notes', 'TSV 6 列。備考に「色: 灰, 黒, 白, 赤, 青, 緑, 黄」全行', ['部品名\t型式\tメーカ\t数量\t単位\t備考', ...Array.from({ length: 50 }, (_, i) => T([`部品${i}`, `M-${i}`, 'オムロン', '1', '個', '色: 灰, 黒, 白, 赤, 青, 緑, 黄']))].join('\n'), 'tab', 50)
add('D17-tsv-address', 'TSV 3 列。メーカ「住所」に東京都, 千代田区, 1-1, ビル, 3F, 100-0001 コンマ 5', ['部品名\t型式\t仕入先', ...Array.from({ length: 10 }, (_, i) => T([`部品${i}`, `M-${i}`, '東京都, 千代田区, 1-1, ビル, 3F, 100-0001']))].join('\n'), 'tab', 10)
add('D18-csv-tsv-mix-half', 'CSV 4 列、半分の行の型式にタブ 4 つ', ['部品名,型式,数量,備考', ...Array.from({ length: 10 }, (_, i) => C([`部品${i}`, i % 2 ? 'a\tb\tc\td\te' : `M-${i}`, '1', '']))].join('\n'), 'comma', 10)
add('D19-tsv-onlycomma-cells', 'TSV 2 列: 左は部品名、右はコンマ区切りの型式リスト（候補）', ['部品名\t型式候補', ...Array.from({ length: 6 }, (_, i) => T([`部品${i}`, 'A-1, A-2, A-3, A-4']))].join('\n'), 'tab', 6)
const out: any[] = []
let ng = 0
for (const c of cases) {
  let r: any
  const t0 = process.cpuUsage()
  try { r = parseBomPaste(c.text) } catch (e: any) { r = { rows: [], delimiter: 'EXC ' + e.message, warnings: [] } }
  const ms = Math.round((process.cpuUsage(t0).user + process.cpuUsage(t0).system) / 1000)
  const ok = r.delimiter === c.expectDelim && r.rows.length === c.expectRows
  if (!ok) ng++
  out.push({ id: c.id, note: c.note, expect: `${c.expectDelim}/${c.expectRows}`, got: `${r.delimiter}/${r.rows.length}`, ok, ms, sample: r.rows.slice(0, 2).map((x: any) => [x.name, x.model, x.maker, x.qtyNeeded, x.note].join(' / ')) })
  console.log(`${ok ? 'ok ' : 'NG '} ${c.id} exp=${c.expectDelim}/${c.expectRows} got=${r.delimiter}/${r.rows.length} ${ok ? '' : JSON.stringify(r.rows.slice(0, 2).map((x: any) => [x.name, x.model, x.maker, x.note].join('|')))}`)
}
console.log('NG', ng, '/', cases.length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/230-delim-consistency' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
