// 〃の代わりの「"」（囲まない）・インチ・「"」始まりの文字を、Excel 風に囲んだ複数行セル・コンマ入りセルと混ぜた CSV/TSV。
// 手書き・古いツールの CSV を想定。期待は「"」のセルが「"」のまま、行数が変わらない。
import fs from 'node:fs'
import { parseTable, rng, norm, same } from './h22.ts'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const N = Number(process.env.N ?? 3000)
const { pick, chance, int } = rng(Number(process.env.SEED ?? 11))
const q = (c: string, raw: Set<string>) => (raw.has(c) ? c : c.includes(D) || c.includes('"') || c.includes('\n') ? '"' + c.replace(/"/g, '""') + '"' : c)
const agg: Record<string, [number, number]> = {}
const bump = (k: string, bad: boolean) => { const a = (agg[k] ??= [0, 0]); a[0]++; if (bad) a[1]++ }
const out: any[] = []
let total = 0, bad = 0
for (let i = 0; i < N; i++) {
  const nRows = pick([3, 8, 40, 200])
  const dittoCol = pick([0, 1, 2, 4])
  const dittoKind = pick(['"', '〃'])
  const pDitto = pick([0.2, 0.6, 1])
  const mlP = pick([0, 0.1, 0.5])
  const commaP = pick([0, 0.3, 1])
  const inchP = pick([0, 0.3])
  const commasInML = int(7)
  const rows: string[][] = [['部品名', '型式', 'メーカ', '数量', '備考']]
  const raw = new Set<string>()
  for (let r = 1; r <= nRows; r++) {
    const row = [`部品${r}`, `M-${r}`, 'オムロン', String(r), '']
    if (chance(commaP)) row[2] = 'Omron, Inc.'
    if (chance(inchP)) row[1] = '3/4"'
    if (chance(mlP)) row[4] = Array.from({ length: commasInML + 1 }, (_, k) => '項目' + k).join(', ').replace(/(.{8})/, '$1\n')
    if (r > 1 && chance(pDitto)) { row[dittoCol] = dittoKind; if (dittoKind.includes('"')) raw.add(dittoKind) }
    rows.push(row)
  }
  // 「3/4"」は囲まない（手書き）
  raw.add('3/4"')
  const text = rows.map((r) => r.map((c) => q(c, raw)).join(D)).join('\n') + '\n'
  const got = parseTable(text, D)
  const ok = same(got, norm(rows))
  total++; if (!ok) bad++
  bump(`ditto=${dittoKind} col${dittoCol}`, !ok); bump(`ml=${mlP}`, !ok); bump(`comma=${commaP}`, !ok); bump(`inch=${inchP}`, !ok); bump(`mlCommas=${mlP ? commasInML : '-'}`, !ok); bump(`pDitto=${pDitto}`, !ok)
  if (!ok && out.length < 20) out.push({ i, dittoKind, dittoCol, pDitto, mlP, commaP, inchP, commasInML, nRows, exp: rows.length, got: got.length, text: text.slice(0, 360) })
}
const rate = Object.fromEntries(Object.entries(agg).sort().map(([k, [n, b]]) => [k, `${b}/${n}`]))
console.log(JSON.stringify({ total, bad, rate }, null, 1))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/193-table-raw-ditto-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ total, bad, rate, cases: out }, null, 1))
