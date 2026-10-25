// 全列挙: 3 行 × (型式, メーカ, 備考) の各セルを {普通, 複数行の囲み（コンマ入り）, 囲まない「"」, 囲まない 3/4"} の 4 種にして 4^9 = 262,144 通り。行数が合うか（CSV / TSV）。
import fs from 'node:fs'
import { parseTable } from './h22.ts'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const MLC = D === ',' ? '"a, b\nc"' : '"a, b\nc"'
const V = ['x', 'ml', 'd', 'i']
const val = (k: string, plain: string) => (k === 'x' ? plain : k === 'ml' ? MLC : k === 'd' ? '"' : '3/4"')
const cells: string[][] = []
for (const a of V) for (const b of V) for (const c of V) cells.push([a, b, c])
const bits: string[] = []
const texts: string[] = []
for (const r1 of cells) for (const r2 of cells) for (const r3 of cells) {
  const mk = (r: string[], n: number) => [`部品${n}`, val(r[0], 'M-' + n), val(r[1], 'オムロン'), String(n), r[2] === 'x' ? '' : val(r[2], '')].join(D)
  const text = [['部品名', '型式', 'メーカ', '数量', '備考'].join(D), mk(r1, 1), mk(r2, 2), mk(r3, 3)].join('\n') + '\n'
  bits.push(parseTable(text, D).length === 4 ? '1' : '0'); texts.push(text)
}
console.log('ok', bits.filter((b) => b === '1').length, '/', bits.length)
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/dl/222-quote-ml-enum-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ bits: bits.join(''), texts }))
