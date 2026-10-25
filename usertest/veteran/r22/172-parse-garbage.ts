// ラウンド20: 取り込みに乱数の文字列（引用符・区切り・改行・矢印・見出しの語・削除の語・半角カナ）を大量に食わせて、例外・長い時間・行が増えすぎるのを探す。現行と r19 ビルド
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, parseTable } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
let s = Number(process.env.SEED ?? 5) >>> 0
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296)
const TOK = ['"', '"', '""', ',', ',', '\t', '\t', '\n', '\n', '\r\n', '\r', '→', '->', '>', '-', '－', 'a', 'M-1', '数量', '部品名', '型式', '変更後型式', '備考', '変更内容', '変更区分', '削除', '削除済', '〃', '同上', ' ', '　', '1', '0', '2+1', 'ﾋﾝﾒｲ', 'ｽｳﾘｮｳ', '【削除？】', 'DNP', '未実装', '製作台数', '3台', '号機', '1号機(旧)', '1号機(新)', '員数', '手配数', 'Comment', 'Value', 'Description', ' ', '﻿', '\u0000', '😀', '"abc', 'abc"', '1/2"', '＂', '“', '”']
const N = Number(process.env.N ?? 20000)
let exc = 0, slow = 0, big = 0, maxMs = 0
const bad: unknown[] = []
for (let i = 0; i < N; i++) {
  const len = 1 + Math.floor(rnd() * 120)
  let t = ''
  for (let k = 0; k < len; k++) t += TOK[Math.floor(rnd() * TOK.length)]
  const t0 = performance.now()
  try {
    const r = parseBomPaste(t)
    const ms = performance.now() - t0
    if (ms > maxMs) maxMs = ms
    if (ms > 200) { slow++; if (bad.length < 10) bad.push({ kind: 'slow', ms: Math.round(ms), text: t.slice(0, 200) }) }
    const nl = t.split(/\r\n?|\n/).length
    if (r.rows.length > nl) { big++; if (bad.length < 10) bad.push({ kind: 'more-rows-than-lines', rows: r.rows.length, lines: nl, text: t.slice(0, 200) }) }
    for (const row of r.rows as any[]) for (const [k, v] of Object.entries(row)) if (typeof v === 'number' && !Number.isFinite(v)) { exc++; if (bad.length < 10) bad.push({ kind: 'NaN', k, text: t.slice(0, 200) }) }
  } catch (e: any) {
    exc++
    if (bad.length < 10) bad.push({ kind: 'exception', msg: String(e?.message ?? e).slice(0, 100), text: t.slice(0, 200) })
  }
}
const sum = { src: SRC, N, exc, slow, big, maxMs: Math.round(maxMs), bad }
console.log(JSON.stringify(sum, null, 1))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/172-parse-garbage' + (process.env.TAG ?? '') + '.json', JSON.stringify(sum, null, 1))
