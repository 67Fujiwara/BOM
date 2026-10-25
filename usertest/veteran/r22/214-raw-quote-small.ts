// 小さな全列挙: 3 行 × (型式, メーカ, 備考) の各セルを {普通, 「"」だけ, 3/4"} にして 27^3 = 19,683 通り。行数が合うか。結果を 0/1 で保存して 2 ビルドで比べる。
import fs from 'node:fs'
import { parseTable } from './h22.ts'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const V = ['x', '"', '3/4"']
const cells: string[][] = []
for (const a of V) for (const b of V) for (const c of V) cells.push([a, b, c])
const texts: string[] = [], bits: string[] = []
for (const r1 of cells) for (const r2 of cells) for (const r3 of cells) {
  const mk = (r: string[], n: number) => [`部品${n}`, r[0] === 'x' ? 'M-' + n : r[0], r[1] === 'x' ? 'オムロン' : r[1], String(n), r[2] === 'x' ? '' : r[2]].join(D)
  const text = [['部品名', '型式', 'メーカ', '数量', '備考'].join(D), mk(r1, 1), mk(r2, 2), mk(r3, 3)].join('\n') + '\n'
  texts.push(text); bits.push(parseTable(text, D).length === 4 ? '1' : '0')
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/dl/214-raw-quote-small${D === '\t' ? '-tsv' : ''}${process.env.TAG ?? ''}.json`, JSON.stringify({ bits: bits.join(''), texts }))
console.log('ok', bits.filter((b) => b === '1').length, '/', bits.length)
