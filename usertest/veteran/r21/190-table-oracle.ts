// parseTable の正解つき乱数。RFC 風に書き出した（Excel の CSV / クリップボードの TSV）表は、そのまま元の表に戻ること。
// MODE=rfc: 正しく囲んだ表。 MODE=raw: 〃の代わりの「"」・インチを囲まずに混ぜた表（中のセルは期待どおり「"」）
import fs from 'node:fs'
import { parseTable, rng, renderCsv, norm, same } from './h21.ts'
const MODE = process.env.MODE ?? 'rfc'
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const N = Number(process.env.N ?? 4000)
const R = rng(Number(process.env.SEED ?? 1))
const { pick, chance, int } = R
const PLAIN = ['リレー', 'MY4N', 'オムロン', '4', '個', '盤内', 'R1', '3', 'XW2B-20G5', '部品A', ' 前空白', '後空白 ', 'a b', '制御盤A', '12']
const COMMA = ['Omron, Inc.', 'A, B', 'ターミナル, 2極', 'R1, R2, R3, R4, R5, R6', '色: 灰, 黒', ',', 'x,', ',y', '注意: A, B, C, D, E, F, G, H']
const QUOT = ['3/4"', '"特注"品', '1" x 2"', '"', 'x"y', '""', '"a"', 'パイプ 3/4", 長さ 2m']
const ML = ['1行目\n2行目', '配線注意\n(要確認)', 'a\nb\nc\nd', '1行目\n2行目, 3', 'R1, R2, R3,\nR4, R5, R6', '注意: A, B, C, D\n交換時は電源断', '"引用"\n続き', '末尾改行\n', '\n先頭改行', 'x\n\ny', '"\n"']
const TABS = D === '\t' ? ['a\tb', '\t', 'x\t'] : []
function cell(kind: string) {
  if (kind === 'plain') return pick(PLAIN)
  if (kind === 'comma') return pick(COMMA)
  if (kind === 'quote') return pick(QUOT)
  if (kind === 'ml') return pick(ML)
  if (kind === 'tab') return pick(TABS.length ? TABS : PLAIN)
  return ''
}
const bitsArr: string[] = []
const textsArr: string[] = []
const out: any[] = []
const stat = { n: 0, bad: 0, byKind: {} as Record<string, number> }
for (let i = 0; i < N; i++) {
  const cols = 3 + int(6)
  const nRows = 2 + int(18)
  const weights = { plain: 10, comma: chance(0.6) ? 3 : 0, quote: chance(0.4) ? 2 : 0, ml: chance(0.6) ? 3 : 0, tab: 1, empty: 2 }
  const bag: string[] = []
  for (const [k, w] of Object.entries(weights)) for (let j = 0; j < w; j++) bag.push(k)
  const table: string[][] = []
  const kinds: string[][] = []
  for (let r = 0; r < nRows; r++) {
    const row: string[] = [], kr: string[] = []
    for (let c = 0; c < cols; c++) { const k = pick(bag); kr.push(k); row.push(cell(k)) }
    table.push(row); kinds.push(kr)
  }
  // 表題の行（区切りなし）
  const titles: string[][] = []
  const nt = chance(0.3) ? 1 + int(5) : 0
  for (let t = 0; t < nt; t++) titles.push([pick(['部品表', '制御盤A 部品表 2026-10-25', '作成: 山田', 'BOM'])])
  const all = [...titles, ...table]
  let text: string
  let expect: string[][]
  if (MODE === 'rfc') {
    text = renderCsv(all.map((r) => r.map((c) => c)), D, { quoteAll: chance(0.1), crlf: chance(0.3) })
    // 表題の行は 1 セルだけ（列の数が合わない）が、Excel も同じ
    expect = norm(all)
  } else {
    // raw: 「"」だけのセル・インチは囲まずに書く。それ以外は RFC 風
    const q = (c: string) => (c === '"' ? c : /^[^"]+"$/.test(c) && !c.includes(D) && !c.includes('\n') ? c : c.includes(D) || c.includes('"') || c.includes('\n') ? '"' + c.replace(/"/g, '""') + '"' : c)
    text = all.map((r) => r.map(q).join(D)).join('\n') + '\n'
    expect = norm(all)
  }
  const got = parseTable(text, D)
  stat.n++
  const ok = same(got, expect)
  bitsArr.push(ok ? '1' : '0'); textsArr.push(text)
  if (!ok) {
    stat.bad++
    const kk = [...new Set(kinds.flat())].sort().join('+')
    stat.byKind[kk] = (stat.byKind[kk] ?? 0) + 1
    if (out.length < 40) out.push({ i, text: text.slice(0, 600), expect: expect.slice(0, 12), got: got.slice(0, 12), rowsExpect: expect.length, rowsGot: got.length })
  }
}
console.log(JSON.stringify(stat))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/dl/190-bits-${MODE}-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ bits: bitsArr.join(''), texts: textsArr }))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/190-table-oracle-${MODE}-${D === ',' ? 'csv' : 'tsv'}${process.env.TAG ?? ''}.json`, JSON.stringify({ stat, cases: out }, null, 1))
