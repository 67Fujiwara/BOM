// ラウンド20: 普通の BOM（変更表でない）を乱数で作り、現行（688ceb6）と r19 ビルド（5bb9df8）の parseBomPaste で結果を比べる。
// 差が出たものを 150-ordinary-diff.mjs で集める。SEED・N・MODE（tsv|csv|xlsx）で変える。結果は dl/150-<tag>.jsonl
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, xlsxToTsv } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
let s = Number(process.env.SEED ?? 1) >>> 0
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]
const chance = (p: number) => rnd() < p
const N = Number(process.env.N ?? 1500)
const PLAIN = (process.env.POOL ?? 'plain') === 'plain' // plain: r19 で意図して変えた語（半角カナ見出し・変更内容・DNP・未実装・手配数）を除く
const MODE = process.env.MODE ?? 'tsv'
const TAG = process.env.TAG ?? ''
const NAMES = ['抵抗', 'コンデンサ', 'リレー', '端子台', '電磁接触器', 'ブレーカ', '表示灯', 'ケーブル', 'ターミナル, 2極', '取外し工具', '撤去用ブラケット', '未実装基板', 'DNP フィルム', 'ｺﾈｸﾀ', 'ＤＩＮレール', 'パイプ 3/4"', 'ヒューズホルダ', '押しボタン(赤)', 'タイマ', 'ファン', '"特注"品', '電源ユニット', 'LED 5mm', '削除用治具', '廃止品交換用', 'Del-Box', '欠番管理票', '中止灯', '不要物箱']
const MODELS = ['MY4N', 'MY4N-D2 DC24', 'XW2B-20G5', '1/2"-NPT', '0.5"x3"', 'PYF14A', 'H3CR-A8', 'NP-100', 'GRM188', 'RC0603-10K', 'ｶﾀﾊﾞﾝ-1', 'A/B', '3.5" HDD', 'MS-N10', 'SC-N2 AC200V', 'CP-100', 'IDEC,HW1B', '-', '－', '×', 'なし', 'N/A', '未定', 'TBD']
const MAKERS = ['オムロン', '三菱電機', '', 'IDEC', 'パナソニック', 'DNP', '〃', '同上', '"', '-', '－', '自社', 'ミスミ', 'Omron, Inc.', 'ｵﾑﾛﾝ', '社内製作', '未実装', '支給品']
const NOTES = ['', '', '', '', '盤内', '取外し時注意', '削除不可', '削除予定', '撤去品流用', '変更なし', 'Rev.2', '要確認', '未実装時は短絡', '実装しない', 'DNP', '新規', '追加', '変更', '位置変更', '削除', '撤去済', 'ＤＮＰ', '削除済', '取外し可能', '廃止予定', '→', '1→2', 'R12に置換のため削除', '2台目から', '〃', '同上', '"', '※注意\n（改行つき）', '色: 灰, 黒', '３／４"']
const REFS = ['', 'R1', 'R1, R2, R3', 'C1-C4', 'K1', 'TB1', '', 'U1']
const HEADERS: Record<string, string[]> = {
  name: ['部品名', '品名', '名称', '品目', 'Description', 'Item', 'Part Name', '部品名称', 'ﾋﾝﾒｲ', 'Value'],
  model: ['型式', '形式', '型番', '品番', 'Model', 'MPN', 'Part No', 'P/N', 'ｶﾀｼｷ'],
  maker: ['メーカ', 'メーカー', 'Maker', 'Manufacturer', 'Mfr', 'ﾒｰｶｰ', 'メーカ名'],
  qty: ['数量', '員数', '個数', 'Qty', 'Quantity', '必要数', '手配数', '使用数', 'ｽｳﾘｮｳ', '数'],
  unit: ['単位', 'Unit'],
  ref: ['回路記号', '記号', 'Designator', 'RefDes', 'Reference'],
  note: ['備考', '摘要', 'Remarks', 'Note', 'Comment', '変更内容', 'メモ'],
  drawing: ['図番', '図面番号', 'Drawing'],
  category: ['分類', '区分', 'ユニット', 'カテゴリ'],
  pack: ['入数'],
}
const qtyV = () => pick(['1', '2', '4', '10', '100', '3個', '5 m', '１２', '2+1', '0', '', '1.5', '20本'])
function makeCase() {
  const cols = ['name', 'model']
  if (chance(0.85)) cols.push('maker')
  cols.push('qty')
  if (chance(0.4)) cols.push('unit')
  if (chance(0.3)) cols.push('ref')
  if (chance(0.5)) cols.push('note')
  if (chance(0.2)) cols.push('drawing')
  if (chance(0.2)) cols.unshift('category')
  if (chance(0.1)) cols.push('pack')
  if (chance(0.2)) cols.sort(() => rnd() - 0.5)
  const hdr = cols.map((c) => pick(HEADERS[c === 'qty' ? 'qty' : c]))
  const nRows = 2 + Math.floor(rnd() * (chance(0.1) ? 60 : 10))
  const rows: string[][] = []
  for (let i = 0; i < nRows; i++) {
    rows.push(cols.map((c) => {
      switch (c) {
        case 'name': return chance(0.3) ? pick(NAMES) : `部品${i + 1}`
        case 'model': return chance(0.5) ? pick(MODELS) : `M-${i + 1}`
        case 'maker': return pick(MAKERS)
        case 'qty': return qtyV()
        case 'unit': return pick(['個', '本', 'm', 'セット', '式', ''])
        case 'ref': return pick(REFS)
        case 'note': return pick(NOTES)
        case 'drawing': return pick(['', 'D-1', 'DWG-2'])
        case 'category': return pick(['制御', '電源', '盤', ''])
        case 'pack': return pick(['', '10', '100'])
      }
      return ''
    }))
  }
  const title: string[][] = []
  if (chance(0.25)) title.push([pick(['部品表 制御盤A', 'BOM', '制御盤A 部品表 2026-10-25', '部品表,制御盤A'])])
  if (chance(0.1)) title.push(['作成', '山田', '承認', '鈴木'])
  const tail: string[][] = chance(0.2) ? [['合計', ...cols.slice(1).map(() => '')]] : []
  return { cols, truth: rows.map((r) => ({ name: cols.includes('name') ? r[cols.indexOf('name')] : '', model: cols.includes('model') ? r[cols.indexOf('model')] : '', note: cols.includes('note') ? r[cols.indexOf('note')] : '' })), table: [...title, hdr, ...rows, ...tail] }
}
if (PLAIN) {
  const bad = /DNP|ＤＮＰ|未実装|実装しない|ｺﾈｸﾀ|ｵﾑﾛﾝ|ｶﾀﾊﾞﾝ|→|1→2/
  for (const a of [NAMES, MODELS, MAKERS, NOTES]) for (let i = a.length - 1; i >= 0; i--) if (bad.test(a[i])) a.splice(i, 1)
  HEADERS.name = HEADERS.name.filter((h) => !/ﾋﾝﾒｲ/.test(h)); HEADERS.model = HEADERS.model.filter((h) => !/ｶﾀｼｷ/.test(h)); HEADERS.maker = HEADERS.maker.filter((h) => !/ﾒｰｶｰ/.test(h)); HEADERS.qty = HEADERS.qty.filter((h) => !/ｽｳﾘｮｳ|手配数/.test(h)); HEADERS.note = HEADERS.note.filter((h) => !/変更内容/.test(h))
}
const q = (c: string, d: string) => (/["\n]/.test(c) || c.includes(d) ? '"' + c.replace(/"/g, '""') + '"' : c)
const render = (t: string[][], d: string, quote: boolean) => t.map((r) => r.map((c) => (quote ? q(c, d) : c.replace(/[\n]/g, ' '))).join(d)).join(chance(0.3) ? '\r\n' : '\n') + '\n'
const out: string[] = []
for (let i = 0; i < N; i++) {
  const c = makeCase()
  let text: string
  if (MODE === 'xlsx') {
    const wb = new ExcelJS.Workbook(); const sh = wb.addWorksheet('BOM'); for (const r of c.table) sh.addRow(r)
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
    text = await xlsxToTsv(buf)
  } else if (MODE === 'csv') {
    // Excel の CSV: コンマを含むセルは囲む。たまに囲まない（手書き）
    text = render(c.table, ',', process.env.QUOTE ? (rnd(), true) : chance(0.85))
  } else {
    text = render(c.table, '\t', process.env.QUOTE ? (rnd(), true) : chance(0.85))
  }
  let res: any
  try { res = parseBomPaste(text) } catch (e: any) { res = { error: String(e?.message ?? e) } }
  out.push(JSON.stringify({ truth: c.truth, i, text: text.length > 3000 ? text.slice(0, 3000) : text, n: res.rows?.length, rows: res.rows?.map((r: any) => [r.name, r.model, r.maker, r.qtyNeeded, r.unit, r.ref ?? '', r.drawing ?? '', r.note ?? '', r.category ?? '', r.packQty ?? ''].join('\u0001')), mapping: res.mapping?.join(','), warnings: res.warnings, error: res.error }))
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r20/dl/150-${process.env.POOL ?? "plain"}${process.env.QUOTE ? "Q" : ""}-${MODE}-${process.env.SEED ?? 1}${TAG}.jsonl`, out.join('\n'))
console.log('done', out.length)
