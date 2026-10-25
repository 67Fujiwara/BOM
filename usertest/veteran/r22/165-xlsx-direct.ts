// ラウンド20: xlsx の形（取消線・数式の書き写し・隠した変更区分の列・結合）を xlsxToTsv → parseBomPaste で。現行と r19 ビルド
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { xlsxToTsv, parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const out: unknown[] = []
async function run(id: string, note: string, expect: string, build: (ws: any) => void) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('BOM'); build(ws)
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const tsv = await xlsxToTsv(buf)
  const r = parseBomPaste(tsv)
  const rec = { id, note, expect, n: r.rows.length, rows: (r.rows as any[]).map((x) => [x.name, x.model, x.maker, x.qtyNeeded, x.note ?? ''].join(' / ')), warnings: r.warnings }
  out.push(rec); console.log(`## ${id} ${note}\n期待: ${expect}\n n=${rec.n} | ${rec.rows.join(' ; ').slice(0, 300)}\n W: ${r.warnings.join(' ／ ').slice(0, 300)}`)
}
await run('X1-strikethrough', '取消線の行が削除された部品（備考なし）', '取消線の行は取り込まない（少なくとも知らせる）', (ws) => {
  ws.addRow(['部品名', '型式', 'メーカ', '数量']); ws.addRow(['リレー', 'MY4N', 'オムロン', 2])
  const r = ws.addRow(['タイマ', 'H3CR', 'オムロン', 1]); r.eachCell((c: any) => { c.font = { strike: true } })
  ws.addRow(['端子台', 'XW2B', 'オムロン', 2])
})
await run('X2-formula-copy', '変更後型式が数式（=B2）で書き写し、削除の行は空（数式なし）', '書き写し 3・変更 1・削除 2 → 4 部品または【削除？】', (ws) => {
  ws.addRow(['部品名', '型式', '変更後型式', '数量'])
  for (let i = 2; i <= 4; i++) ws.addRow([`A${i}`, `M-${i}`, { formula: `B${i}`, result: `M-${i}` }, 1])
  ws.addRow(['C5', 'M-5', 'N-5', 1]); ws.addRow(['D6', 'M-6', null, 1]); ws.addRow(['D7', 'M-7', null, 1])
})
await run('X3-formula-empty-string', '変更後型式が =IF(…,"","") で空文字を返す行（変えていない）と変更の行', '空文字は空のセル。変えていない行は残る', (ws) => {
  ws.addRow(['部品名', '型式', '変更後型式', '数量', '備考'])
  ws.addRow(['A', 'M-1', { formula: 'IF(1=1,"","")', result: '' }, 1, ''])
  ws.addRow(['B', 'M-2', 'N-2', 1, '型式変更'])
  ws.addRow(['C', 'M-3', { formula: 'IF(1=1,"","")', result: '' }, 1, ''])
})
await run('X4-hidden-kind-col', '隠した「変更区分」の列（削除の行あり）', '隠した列も区分の値は見て削除の行を外す（または知らせる）', (ws) => {
  ws.addRow(['変更区分', '部品名', '型式', '数量']); ws.addRow(['追加', 'A', 'M-1', 1]); ws.addRow(['削除', 'B', 'M-2', 1]); ws.addRow(['変更', 'C', 'M-3', 1])
  ws.getColumn(1).hidden = true
})
await run('X5-merged-title-units', '結合した表題「製作台数」「3台」と 1台当り数量', '3 台を掛ける（リレー 6）', (ws) => {
  ws.addRow(['製作台数', '', '3台']); ws.mergeCells('A1:B1'); ws.addRow([]); ws.addRow(['部品名', '型式', '1台当り数量']); ws.addRow(['リレー', 'MY4N', 2])
})
await run('X6-red-fill-deleted', '削除の行を赤塗り（備考なし）', '（読めない。取り込む）', (ws) => {
  ws.addRow(['部品名', '型式', '数量']); ws.addRow(['A', 'M-1', 1]); const r = ws.addRow(['B', 'M-2', 1]); r.eachCell((c: any) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } } })
})
await run('X7-number-cells-dash', '変更後型式のセルが数値 0 / 文字 "-" / 全角マイナス', '0 は削除ではなく型式 0 か空', (ws) => {
  ws.addRow(['部品名', '型式', '変更後型式', '数量']); ws.addRow(['A', 'M-1', 0, 1]); ws.addRow(['B', 'M-2', '-', 1]); ws.addRow(['C', 'M-3', '−', 1]); ws.addRow(['D', 'M-4', 'N-4', 1])
})
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/165-xlsx-direct' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
