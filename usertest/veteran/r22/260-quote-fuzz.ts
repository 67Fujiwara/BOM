// ラウンド22: 新しい引用符の規則（「"」はセルの先頭にあり、直後が区切りでないときだけ囲みの始まり／直後が区切りで、その行を囲みなしで数えた区切りの数が列の数と合えば〃）を、
// 正解つきの乱数で。行 3〜8 × 列 5 × セルの種類 9（普通・Excel の複数行コンマ入り・〃の「"」・3/4"・コンマで始まる囲み ",x"・空の囲み ""・中に "" のある囲み・途中の引用符・先頭が引用符で閉じる "特注"品）。
// parseTable の出力が正解（セル内の改行は空白）と一致するか。CSV / TSV。現行と r21b
import fs from 'node:fs'
import { parseTable, rng } from './h22.ts'
const N = Number(process.env.N ?? 100000)
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const { pick, chance, int } = rng(Number(process.env.SEED ?? 22))
type Kind = 'x' | 'ml' | 'd' | 'i' | 'qc' | 'qe' | 'qs' | 'mid' | 'lead'
const NOML = process.env.KINDSET === 'noml'
const MLONLY = process.env.KINDSET === 'mlonly' || process.env.KINDSET === 'ml1'
const RFC = NOML || MLONLY || process.env.KINDSET === 'rfc' || process.env.KINDSET === 'rfc-noqc'
const NOQC = process.env.KINDSET === 'rfc-noqc'
const KINDS: Kind[] = NOML ? ['x', 'x', 'qc', 'qe', 'qs'] : MLONLY ? ['x', 'x', 'ml'] : RFC ? (D === ',' && !NOQC ? ['x', 'x', 'ml', 'qc', 'qe', 'qs'] : ['x', 'x', 'ml', 'qe', 'qs']) : D === ',' ? ['x', 'x', 'x', 'ml', 'd', 'i', 'qc', 'qe', 'qs', 'mid', 'lead'] : ['x', 'x', 'x', 'ml', 'd', 'i', 'qe', 'qs', 'mid', 'lead']
const render = (k: Kind, r: number, c: number): [string, string] => {
  switch (k) {
    case 'x': return [`v${r}${c}`, `v${r}${c}`]
    case 'ml': return [`"a${c}, b\nc, d"`, `a${c}, b c, d`]
    case 'd': return ['"', '"']
    case 'i': return ['3/4"', '3/4"']
    case 'qc': return [`",x${c}"`, `,x${c}`]
    case 'qe': return ['""', '']
    case 'qs': return ['"a""b"', 'a"b']
    case 'mid': return [`パイプ 1" 長尺${c}`, `パイプ 1" 長尺${c}`]
    case 'lead': return [`"特注"品${c}`, `"特注"品${c}`]
  }
}
const bits: string[] = [], bad: any[] = []
const byKind = new Map<string, { n: number; bad: number }>()
for (let t = 0; t < N; t++) {
  const nr = 3 + int(6), nc = 5
  const kinds: Kind[][] = [], texts: string[] = [], truth: string[][] = []
  const dens = pick([0.1, 0.3, 0.6])
  for (let r = 0; r < nr; r++) {
    const row: string[] = [], tr: string[] = [], ks: Kind[] = []
    for (let c = 0; c < nc; c++) { let k: Kind = r === 0 ? 'x' : chance(dens) ? pick(KINDS) : 'x'; if (process.env.KINDSET === 'ml1' && k === 'ml' && ks.includes('ml')) k = 'x'; const [raw, val] = render(k, r, c); row.push(raw); tr.push(val); ks.push(k) }
    texts.push(row.join(D)); truth.push(tr); kinds.push(ks)
  }
  const text = texts.join(chance(0.3) ? '\r\n' : '\n') + '\n'
  const got = parseTable(text, D).filter((r) => r.some((c) => c !== ''))
  const ok = JSON.stringify(got) === JSON.stringify(truth)
  bits.push(ok ? '1' : '0')
  const used = new Set(kinds.flat().filter((k) => k !== 'x'))
  for (const k of used) { const e = byKind.get(k) ?? { n: 0, bad: 0 }; e.n++; if (!ok) e.bad++; byKind.set(k, e) }
  if (!ok && bad.length < 40) bad.push({ text, got: got.slice(0, 8), kinds: kinds.map((r) => r.join(',')).join(' / ') })
}
const okN = bits.filter((b) => b === '1').length
console.log(`DELIM=${JSON.stringify(D)} N=${N} ok=${okN} bad=${N - okN}`)
console.log([...byKind.entries()].map(([k, v]) => `${k}: ${v.bad}/${v.n}`).join('  '))
for (const b of bad.slice(0, 6)) console.log(JSON.stringify(b).slice(0, 600))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/dl/260-quote-fuzz${MLONLY || NOML ? '-' + process.env.KINDSET : NOQC ? '-rfc-noqc' : RFC ? '-rfc' : ''}${D === '\t' ? '-tsv' : ''}${process.env.TAG ?? ''}.json`, JSON.stringify({ bits: bits.join(''), bad }))
