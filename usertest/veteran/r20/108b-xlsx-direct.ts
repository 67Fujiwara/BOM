// ラウンド16: 108-xlsx-r16 の .xlsx / .csv を、現行と r15 ビルドの xlsxToTsv → parseBomPaste（.csv は文字のまま parseBomPaste）で直接（ガイドを通さない 2 つ目の経路）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { xlsxToTsv, parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const DL = '/home/user/BOM/usertest/veteran/r20/dl/'
const files = fs.readdirSync(DL).filter((f) => /^z\d+[a-z]?-.*\.(xlsx|csv)$/.test(f)).sort()
const out: unknown[] = []
for (const f of files) {
  const b = fs.readFileSync(DL + f)
  const tsv = f.endsWith('.csv') ? b.toString('utf8') : await xlsxToTsv(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  const r = parseBomPaste(tsv)
  const rs = r.rows as any[]
  const line = (x: any) => [x.name, x.model, x.maker, x.qtyNeeded, x.note ?? ''].join(' / ')
  const rec = { f, n: rs.length, qty0: rs.filter((x) => x.qtyNeeded === 0).length, qtySum: rs.reduce((a, x) => a + (x.qtyNeeded ?? 0), 0), noName: rs.filter((x) => !(x.name ?? '').trim()).length, notBuhinN: rs.filter((x) => !/^部品\d+$/.test(x.name ?? '')).length, notBuhin: rs.filter((x) => !/^部品\d+$/.test(x.name ?? '')).map(line).slice(0, 8), modelOld: rs.filter((x) => /^OLD-/.test(x.model ?? '')).length, modelNew: rs.filter((x) => /^NEW-/.test(x.model ?? '')).length, warnings: r.warnings, tsvHead: tsv.split('\n').slice(0, 3), first: rs.slice(0, 3).map(line), around: rs.slice(48, 53).map(line), quotes: rs.filter((x) => /"/.test([x.model, x.note, x.maker].join(''))).map(line).slice(0, 12) }
  out.push(rec)
  console.log(JSON.stringify(rec).slice(0, 1800))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r20/108b-xlsx-direct' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
