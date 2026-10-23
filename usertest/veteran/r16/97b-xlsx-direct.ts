// ラウンド15: 97-xlsx-r15 の .xlsx を、現行と r14 ビルドの xlsxToTsv → parseBomPaste で直接（ガイドを通さない 2 つ目の経路）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { xlsxToTsv, parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const DL = '/home/user/BOM/usertest/veteran/r16/dl/'
const files = fs.readdirSync(DL).filter((f) => /^x\d+-.*\.xlsx$/.test(f)).sort()
const out: unknown[] = []
for (const f of files) {
  const b = fs.readFileSync(DL + f)
  const tsv = await xlsxToTsv(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  const r = parseBomPaste(tsv)
  const line = (x: any) => [x.name, x.model, x.maker, x.qtyNeeded].join(' / ')
  const rec = { f, n: r.rows.length, qty0: r.rows.filter((x: any) => x.qtyNeeded === 0).length, notBuhin: r.rows.filter((x: any) => !/^部品\d+$/.test(x.name ?? '')).map(line).slice(0, 8), notBuhinN: r.rows.filter((x: any) => !/^部品\d+$/.test(x.name ?? '')).length, modelOld: r.rows.filter((x: any) => /^OLD-/.test(x.model ?? '')).length, modelNew: r.rows.filter((x: any) => /^NEW-/.test(x.model ?? '')).length, warnings: r.warnings, tsvHead: tsv.split('\n').slice(0, 4), first: r.rows.slice(0, 3).map(line) }
  out.push(rec)
  console.log(JSON.stringify(rec).slice(0, 1500))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r16/97b-xlsx-direct' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
