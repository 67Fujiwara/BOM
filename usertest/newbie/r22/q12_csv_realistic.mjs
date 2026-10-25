// ラウンド22 q12: 現実的な Excel の CSV（6 列の BOM、備考・品名に Alt+Enter の改行、コンマ入りの備考）を乱数で作って parseBomPaste で読み戻す。旧(OLD)／新の成功率
import fs from 'node:fs'
import { loadParsers } from './parselib.mjs'
const OLDS = (process.env.OLDS || '688ceb6,56e5aba').split(',')
const parsers = {}
for (const o of OLDS) parsers[o] = (await loadParsers(o)).old
parsers.HEAD = (await loadParsers(OLDS[0])).neu
let seed = Number(process.argv[3] || 5)
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const N = Number(process.argv[2] || 1500)
const names1 = ['リレー', 'タイマ', '端子台', 'ケーブル', 'ヒューズ', 'ランプ']
const names2 = process.env.COMMA_NAME ? ['リレー, 小型\n(2P)', 'リレー\n24V, 4極', 'タイマ\nAC100V, 0.5s', '電磁接触器\n(主回路用, 3P)', 'タイマ, AC100V\n(0.5s)', '端子台, 20極\n黒'] : ['リレー\n(小型)', 'タイマ\nAC100V', '端子台\n20極', 'ケーブル\n2m', '電磁接触器\n(主回路用)']
const notes1 = ['', '', '', '盤内上段', '要確認', '予備', '納期注意']
const notes2 = ['盤内上段, 左側\n要確認', '1行目\n2行目', '客先支給, 要確認\n納期注意, 代替可', '注1: a, b\n注2: c', 'メモ\n(確認済)']
const noteSingleComma = ['盤内上段, 左側', 'a, b, c', '要確認, 納期注意']
const ser = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(',')).join('\r\n') + '\r\n'
const fails = {}
for (const k of Object.keys(parsers)) fails[k] = 0
const sample = {}
for (let t = 0; t < N; t++) {
  const nrow = 3 + Math.floor(rnd() * 15)
  const COLS = (process.env.COLS || '品名,型式,メーカー,数量,単位,備考').split(',')
  const rows = [COLS]
  for (let i = 0; i < nrow; i++) { const full = { 品名: rnd() < 0.2 ? pick(names2) : pick(names1), 型式: pick(['MY4N-D2', 'H3CR-A8', 'XW2B-20G4', 'F-5A', 'L-1']), メーカー: pick(['オムロン', 'IDEC', 'ミスミ']), 数量: String(1 + Math.floor(rnd() * 9)), 単位: '個', 備考: rnd() < 0.2 ? pick(notes2) : rnd() < 0.15 ? pick(noteSingleComma) : pick(notes1) }; rows.push(COLS.map((c) => full[c])) }
  const text = ser(rows)
  const mi = COLS.indexOf('型式'), qi = COLS.indexOf('数量')
  const exp = JSON.stringify(rows.slice(1).map((r) => [r[mi], Number(r[qi])]))
  for (const [k, p] of Object.entries(parsers)) {
    let got
    try { const res = p.parseBomPaste(text); got = JSON.stringify(res.rows.map((r) => [r.model, r.qtyNeeded])) } catch { got = 'EXC' }
    if (got !== exp) { fails[k]++; if (!sample[k]) sample[k] = text.slice(0, 500) }
  }
}
console.log(JSON.stringify({ N, fails }))
fs.writeFileSync('results/q12_csv_realistic.out', JSON.stringify({ N, fails, sample }, null, 1) + '\n')
