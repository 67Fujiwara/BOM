// ラウンド23: RFC どおりの CSV/TSV（Excel の書き出し）を、列の数 2〜14・行 2〜12・複数行セル（コンマ 0〜4・改行 1〜3）・空の囲み・"" を含む囲み・全部囲む・列数が足りない行・CRLF で。
// 正解はセルの値（セル内の改行は空白）。",x" のようなコンマで始まる囲みは含めない（既知の限界）が、MODE=qc で含める
import fs from 'node:fs'
import { parseTable, rng } from './h22.ts'
const N = Number(process.env.N ?? 40000)
const D = (process.env.DELIM ?? ',') as ',' | '\t'
const { pick, chance, int } = rng(Number(process.env.SEED ?? 23))
const QC = process.env.MODE === 'qc'
const bits: string[] = [], bad: any[] = []
const by: Record<string, { n: number; bad: number }> = {}
for (let t = 0; t < N; t++) {
  const NCa = Number(process.env.NCMIN ?? 2), NCb = Number(process.env.NCMAX ?? 14), NRa = Number(process.env.NRMIN ?? 2), NRb = Number(process.env.NRMAX ?? 12)
  const nc = NCa + int(NCb - NCa + 1), nr = NRa + int(NRb - NRa + 1)
  const quoteAll = chance(0.15), crlf = chance(0.3), ragged = chance(0.2), mlP = pick((process.env.MLP ?? '0.05,0.2,0.5,0.9').split(',').map(Number)), lead = chance(0.15)
  const truth: string[][] = [], texts: string[] = []
  const used = new Set<string>()
  for (let r = 0; r < nr; r++) {
    const len = r > 0 && ragged && chance(0.5) ? 1 + int(nc) : nc
    const tr: string[] = [], rw: string[] = []
    for (let c = 0; c < len; c++) {
      let kind = r === 0 ? 'x' : chance(mlP) ? 'ml' : pick(['x', 'x', 'x', 'qe', 'qs', 'cm', ...(QC ? ['qc'] : [])])
      if (lead && c === 0 && r > 0 && chance(0.5)) kind = 'ml'
      used.add(kind)
      let raw = '', val = ''
      const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'
      if (kind === 'x') { val = `v${r}_${c}`; raw = quoteAll ? q(val) : val }
      else if (kind === 'ml') { const lines = 2 + int(2); const parts = Array.from({ length: lines }, (_, i) => Array.from({ length: 1 + int(Number(process.env.MLCM ?? 5)) }, (_, k) => `w${i}${k}`).join(D === ',' ? ', ' : ' ')); val = parts.join(' '); raw = q(parts.join('\n')) }
      else if (kind === 'qe') { val = ''; raw = '""' }
      else if (kind === 'qs') { val = 'a"b'; raw = q(val) }
      else if (kind === 'cm') { val = D === ',' ? `a, b ${r}` : `a b ${r}`; raw = D === ',' ? q(val) : val }
      else if (kind === 'qc') { val = `,x${c}`; raw = q(val) }
      tr.push(val); rw.push(raw)
    }
    truth.push(tr); texts.push(rw.join(D))
  }
  const text = texts.join(crlf ? '\r\n' : '\n') + (chance(0.5) ? '\n' : '')
  const got = parseTable(text, D).filter((r) => r.some((c) => c !== ''))
  const exp = truth.filter((r) => r.some((c) => c !== ''))
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  bits.push(ok ? '1' : '0')
  const key = [...used].sort().join('+') + (quoteAll ? '/all' : '') + (ragged ? '/rag' : '')
  for (const k of used) { const e = (by[k] ??= { n: 0, bad: 0 }); e.n++; if (!ok) e.bad++ }
  if (!ok && bad.length < 30) bad.push({ nc, nr, quoteAll, ragged, key, text: text.slice(0, 700), got: got.slice(0, 5), exp: exp.slice(0, 5) })
}
console.log(`DELIM=${JSON.stringify(D)} MODE=${process.env.MODE ?? ''} N=${N} bad=${bits.filter((b) => b === '0').length}`)
console.log(Object.entries(by).map(([k, v]) => `${k}:${v.bad}/${v.n}`).join(' '))
for (const b of bad.slice(0, 4)) console.log(JSON.stringify(b).slice(0, 900))
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/dl/305-rfc-wide${process.env.NAME ?? ''}${D === '\t' ? '-tsv' : ''}${process.env.MODE ?? ''}${process.env.TAG ?? ''}.json`, JSON.stringify({ bad }))
