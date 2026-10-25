// xlsx の形の悪意・事故: (1) 右端 XFD に 1 つだけ値（Ctrl+End で飛ぶ癖）× 2,500 行 (2) 下の方 100 万行目に値 (3) 隠し列 16,000 列 (4) 結合セルだらけ (5) 全行に 200 列
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { xlsxToTsv, parseBomPaste } = await import(SRC + '/io/paste.ts')
const out: any[] = []
async function run(name: string, build: (ws: any) => void) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('BOM'); build(ws)
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const c0 = process.cpuUsage(); const t0 = performance.now()
  let tsvLen = 0, n = -1, err = ''
  try { const tsv = await xlsxToTsv(buf); tsvLen = tsv.length; n = parseBomPaste(tsv).rows.length } catch (e: any) { err = String(e?.message ?? e).slice(0, 100) }
  const c1 = process.cpuUsage(c0)
  const rec = { name, fileKB: Math.round(buf.byteLength / 1024), tsvKB: Math.round(tsvLen / 1024), rows: n, cpuMs: Math.round((c1.user + c1.system) / 1000), wallMs: Math.round(performance.now() - t0), err }
  out.push(rec); console.log(JSON.stringify(rec))
}
const base = (ws: any, n = 2500) => { ws.addRow(['部品名', '型式', 'メーカ', '数量']); for (let i = 1; i <= n; i++) ws.addRow([`部品${i}`, `M-${i}`, 'オムロン', i % 9 + 1]) }
await run('baseline 2500', (ws) => base(ws))
await run('XFD stray value row1', (ws) => { base(ws); ws.getCell(1, 16384).value = 'x' })
await run('XFD stray value last row', (ws) => { base(ws); ws.getCell(2501, 16384).value = 'x' })
await run('row 1,000,000 stray', (ws) => { base(ws); ws.getCell(1000000, 1).value = 'x' })
await run('200 cols all rows', (ws) => { ws.addRow(['部品名', '型式', 'メーカ', '数量', ...Array.from({ length: 196 }, (_, i) => 'c' + i)]); for (let i = 1; i <= 2500; i++) ws.addRow([`部品${i}`, `M-${i}`, 'オムロン', 1, ...Array.from({ length: 196 }, () => '')]) ; ws.getCell(2501, 200).value = 'end' })
await run('hidden cols 3000', (ws) => { base(ws, 300); ws.getCell(1, 3000).value = 'x'; for (let c = 5; c <= 3000; c++) ws.getColumn(c).hidden = true })
await run('merged cells many', (ws) => { base(ws, 500); for (let r = 2; r < 400; r += 2) ws.mergeCells(r, 5, r + 1, 8) })
await run('long text cells 32k', (ws) => { base(ws, 100); for (let r = 2; r <= 101; r++) ws.getCell(r, 5).value = 'あ'.repeat(32000) })
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/216-xlsx-wide${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
