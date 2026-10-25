// 区切りの決め方（タブ区切り・コンマ区切りの多数決）。現行（タブの行が半分以上でタブ）と r20 ビルド（タブが 1 つでもあればタブ）を並べる。
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, xlsxToTsv } = await import(SRC + '/io/paste.ts')
const T = (r: string[]) => r.join('\t')
const hdr = ['部品名', '型式', 'メーカ', '数量', '備考']
const rowsN = (n: number, mk?: (i: number) => string[]) => Array.from({ length: n }, (_, i) => (mk ? mk(i + 1) : [`部品${i + 1}`, `M-${i + 1}`, i % 2 ? 'Omron, Inc.' : 'オムロン', String(i + 1), '']))
const titles = (n: number) => Array.from({ length: n }, (_, i) => ['部品表', '制御盤A', '2026-10-25', '作成 山田', '承認 鈴木', 'Rev.2', '客先 X', '図番 D-100', '納期 12月', '備考欄'][i % 10])
type K = { id: string; note: string; text?: string; sheet?: string[][]; expectDelim: string; expectRows: number }
const cases: K[] = [
  { id: 'T1-tsv-title10-comma', note: 'TSV: 表題 10 行（タブ無し）＋見出し＋8 行、メーカに「Omron, Inc.」', text: [...titles(10), T(hdr), ...rowsN(8).map(T)].join('\n'), expectDelim: 'tab', expectRows: 8 },
  { id: 'T2-tsv-title6-comma', note: 'TSV: 表題 6 行＋見出し＋4 行', text: [...titles(6), T(hdr), ...rowsN(4).map(T)].join('\n'), expectDelim: 'tab', expectRows: 4 },
  { id: 'T3-tsv-title3-comma', note: 'TSV: 表題 3 行＋見出し＋4 行（タブの行 5/8）', text: [...titles(3), T(hdr), ...rowsN(4).map(T)].join('\n'), expectDelim: 'tab', expectRows: 4 },
  { id: 'T4-xlsx-title10-comma', note: 'xlsx: 表題 10 行＋見出し＋8 行（xlsxToTsv は行末の空のセルを出さないので表題の行にタブが無い）', sheet: [...titles(10).map((t) => [t]), hdr, ...rowsN(8)], expectDelim: 'tab', expectRows: 8 },
  { id: 'T5-xlsx-sections', note: 'xlsx: 区切り行（■ 制御部）と部品行が 1:1、コンマ入りあり', sheet: [hdr, ...rowsN(10).flatMap((r, i) => [[`■ 区画${i}`], r])], expectDelim: 'tab', expectRows: 10 },
  { id: 'T6-xlsx-name-only-rows', note: 'xlsx: 部品名だけの行（後ろのセルが空）が多い', sheet: [hdr, ...rowsN(12, (i) => (i % 3 ? [`部品${i}`] : [`部品${i}`, `M-${i}`, 'Omron, Inc.', '1']))], expectDelim: 'tab', expectRows: 12 },
  { id: 'T7-tsv-multiline-cells-comma', note: 'TSV: 備考が 3 行の複数行セル（Excel の貼り付け）、メーカにコンマ', text: [T(hdr), ...rowsN(10, (i) => [`部品${i}`, `M-${i}`, 'Omron, Inc.', String(i), `"1行目\n2行目\n3行目"`]).map(T)].join('\n'), expectDelim: 'tab', expectRows: 10 },
  { id: 'T8-tsv-multiline-nocomma', note: 'TSV: 備考が 3 行の複数行セル、コンマなし', text: [T(hdr), ...rowsN(10, (i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i), `"1行目\n2行目\n3行目"`]).map(T)].join('\n'), expectDelim: 'tab', expectRows: 10 },
  { id: 'T9-csv-tab-indent', note: 'CSV: 各行の頭にタブ（エディタのインデント）', text: ['\t' + hdr.join(','), ...rowsN(5).map((r) => '\t' + r.join(','))].join('\n'), expectDelim: 'comma', expectRows: 5 },
  { id: 'T10-csv-trailing-tab', note: 'CSV: 各行の末尾にタブ', text: [hdr.join(',') + '\t', ...rowsN(5).map((r) => r.join(',') + '\t')].join('\n'), expectDelim: 'comma', expectRows: 5 },
  { id: 'T11-csv-tab-in-note-half', note: 'CSV: 10 行のうち 5 行の備考にタブ', text: [hdr.join(','), ...rowsN(10, (i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i), i % 2 ? '盤内\t上段' : ''])].map((x) => (Array.isArray(x) ? x.join(',') : x)).join('\n'), expectDelim: 'comma', expectRows: 10 },
  { id: 'T12-csv-tab-in-note-quoted-multiline', note: 'CSV: 複数行セルの行にタブ（引用符あり）', text: [hdr.join(','), ...rowsN(6, (i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i), '"盤内\t上段\n左側"']).map((r) => r.join(','))].join('\n'), expectDelim: 'comma', expectRows: 6 },
  { id: 'T13-tsv-one-comma-all-multiline-lines', note: 'TSV: 2 列、複数行セル（各 2 行）＋コンマ', text: ['部品名\t備考', ...Array.from({ length: 6 }, (_, i) => `部品${i}, A\t"x\ny\nz"`)].join('\n'), expectDelim: 'tab', expectRows: 6 },
  { id: 'T14-tsv-exact-half', note: 'TSV: タブの行がちょうど半分（表題 4 行＋見出し＋3 行）', text: [...titles(4), T(hdr), ...rowsN(3).map(T)].join('\n'), expectDelim: 'tab', expectRows: 3 },
  { id: 'T15-tsv-commas-everywhere', note: 'TSV: すべての行にコンマ', text: [T(hdr), ...rowsN(6, (i) => [`部品${i}, A`, `M-${i}`, 'Omron, Inc.', String(i), 'a, b']).map(T)].join('\n'), expectDelim: 'tab', expectRows: 6 },
]
const out: any[] = []
for (const c of cases) {
  let text = c.text
  if (c.sheet) {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('BOM'); for (const r of c.sheet) ws.addRow(r)
    text = await xlsxToTsv((await wb.xlsx.writeBuffer()) as ArrayBuffer)
  }
  const r = parseBomPaste(text!)
  const ok = r.delimiter === c.expectDelim && r.rows.length === c.expectRows
  const rec = { id: c.id, note: c.note, expect: `${c.expectDelim}/${c.expectRows}`, got: `${r.delimiter}/${r.rows.length}`, ok, sample: r.rows.slice(0, 3).map((x: any) => [x.name, x.model, x.maker, x.qtyNeeded].join(' / ')), warn: r.warnings.slice(0, 2).map((w: string) => w.slice(0, 90)) }
  out.push(rec); console.log(`${ok ? 'ok ' : 'NG '} ${c.id} exp=${rec.expect} got=${rec.got} ${ok ? '' : JSON.stringify(rec.sample)}`)
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/195-delim-detect${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
