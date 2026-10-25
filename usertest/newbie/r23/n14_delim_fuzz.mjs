// ラウンド23 n14: 区切り（タブ／コンマ）の乱数。表題・説明のもう一方の区切り、セルの中のもう一方の区切り。旧 68e45f7 と新で、正しく読めた数
import fs from 'node:fs'
import { loadParsers } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
let seed = Number(process.argv[3] ?? 23)
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const N = Number(process.argv[2] ?? 2000)
const hdrs = [['品名', '型式', 'メーカー', '数量'], ['部品名', '形式', 'メーカ', '員数', '備考'], ['Item', 'Part No', 'Manufacturer', 'Qty'], ['品名', '型式', '回路記号', '数量'], ['Designator', 'Comment', 'Footprint', 'Quantity'], ['No', '品名', '型式', 'メーカー', '数量', '備考']]
const names = ['リレー', 'タイマ', '端子台', 'ヒューズ', '抵抗', 'LED', 'ケーブル']
const titleLines = (d, k) => Array.from({ length: k }, (_, i) => pick([`案件名: ○○盤${i}`, '客先: ABC', '担当: 山田', '日付: 2026/10/25', '改訂: 1', '備考: なし']) + Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => d + ' ' + pick(['A', 'B', '1', '2026', 'x', '田中'])).join(''))
const res = { new: { ok: 0, bad: 0, badEx: [] }, old: { ok: 0, bad: 0, badEx: [] } }
const kinds = {}
for (let it = 0; it < N; it++) {
  const shape = pick(['tab', 'csv'])
  const other = shape === 'tab' ? ',' : '\t'
  const h = pick(hdrs)
  const n = 3 + Math.floor(rnd() * 8)
  const body = Array.from({ length: n }, (_, i) => h.map((c, j) => {
    if (/品名|Item|Comment|^No$/.test(c)) return /^No$/.test(c) ? String(i + 1) : pick(names)
    if (/型式|形式|Part|Value/.test(c)) return 'M-' + i
    if (/メーカ|Manufacturer/.test(c)) return pick(['オムロン', 'IDEC', ''])
    if (/数量|員数|Qty|Quantity/.test(c)) return String(1 + Math.floor(rnd() * 9))
    if (/回路記号|Designator/.test(c)) return Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, q) => 'R' + (q + 1)).join(shape === 'tab' ? ',' : ', ')
    if (/Footprint/.test(c)) return '0603'
    return rnd() < 0.3 ? pick(['盤内' + other + '上段', '予備', '']) : ''
  }))
  const q = (c) => (/[",\t\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
  const line = (r) => (shape === 'tab' ? r.join('\t') : r.map(q).join(','))
  const pre = rnd() < 0.7 ? titleLines(other, Math.floor(rnd() * 16)) : []
  const post = rnd() < 0.3 ? titleLines(other, Math.floor(rnd() * 6)) : []
  const text = [...pre, line(h), ...body.map(line), ...post].join('\n')
  const want = n + (post.length ? 0 : 0)
  for (const [lbl, p] of [['new', neu], ['old', old]]) {
    let r; try { r = p.parseBomPaste(text) } catch { r = { rows: [], delimiter: '?' } }
    const okRows = r.rows.length >= n && r.rows.length <= n + post.length
    const okDelim = r.delimiter === (shape === 'tab' ? 'tab' : 'comma')
    if (okRows && okDelim) res[lbl].ok++
    else { res[lbl].bad++; const k = `${shape} pre=${pre.length} post=${post.length} h=${h[0]}/${h[2]}`; if (res[lbl].badEx.length < 12) res[lbl].badEx.push(`${k} → delim=${r.delimiter} rows=${r.rows.length}/${n}`) }
  }
}
const out = [`N=${N} new: ok ${res.new.ok} bad ${res.new.bad} / old: ok ${res.old.ok} bad ${res.old.bad}`, 'new bad examples:', ...res.new.badEx, 'old bad examples:', ...res.old.badEx]
fs.writeFileSync('results/n14_delim_fuzz.out', out.join('\n') + '\n')
console.log(out.join('\n'))
