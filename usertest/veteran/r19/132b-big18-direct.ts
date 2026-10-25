// ラウンド18: 132-big18-make の 300 行のファイルを、現行と r17 ビルドの xlsxToTsv → parseBomPaste（.csv/.tsv は文字のまま）で直接
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { xlsxToTsv, parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const DL = '/home/user/BOM/usertest/veteran/r19/dl/'
const files = fs.readdirSync(DL).filter((f) => /^c\d-.*\.(xlsx|csv|tsv)$/.test(f)).sort()
const out: unknown[] = []
for (const f of files) {
  const b = fs.readFileSync(DL + f)
  const tsv = /\.(csv|tsv)$/.test(f) ? b.toString('utf8') : await xlsxToTsv(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  const r = parseBomPaste(tsv)
  const rs = r.rows as any[]
  const line = (x: any) => [x.name, x.model, x.maker, x.qtyNeeded, x.note ?? ''].join(' / ')
  const rec = { f, n: rs.length, qty0: rs.filter((x) => x.qtyNeeded === 0).length, qtySum: rs.reduce((a, x) => a + (x.qtyNeeded ?? 0), 0), noName: rs.filter((x) => !(x.name ?? '').trim()).length, longMaker: rs.filter((x) => (x.maker ?? '').length > 20).length, modelOld: rs.filter((x) => /^OLD-/.test(x.model ?? '')).length, modelNew: rs.filter((x) => /^NEW-/.test(x.model ?? '')).length, notes: rs.filter((x) => (x.note ?? '').trim()).length, descNames: rs.filter((x) => /^(Capacitor|Resistor|Diode|LED)$/.test(x.name ?? '')).length, dnpMaker: rs.filter((x) => x.maker === 'DNP').length, warnings: r.warnings, first: rs.slice(0, 3).map(line), odd: rs.filter((x) => (x.maker ?? '').length > 20 || !(x.name ?? '').trim() || /"/.test(x.name + x.maker + (x.note ?? ''))).slice(0, 4).map(line) }
  out.push(rec)
  console.log(JSON.stringify(rec).slice(0, 1500))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r19/132b-big18-direct' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
