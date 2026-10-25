// ラウンド23: 現実的な Excel/EDA の CSV（RFC どおり）：回路記号を引用符で囲む行が多く、複数行の備考が数行ある。
// 幅の推定（引用符の無い物理行の区切りの最頻値）が、複数行セルの途中の行（引用符が無い）に汚染されないか。parseBomPaste の行数・部品名で判定
import fs from 'node:fs'
import { parseBomPaste, rng } from './h22.ts'
const { pick, chance, int } = rng(Number(process.env.SEED ?? 11))
const N = Number(process.env.N ?? 3000)
const bad: any[] = []
const stat: Record<string, { n: number; bad: number }> = {}
for (let t = 0; t < N; t++) {
  const nr = pick([8, 15, 30, 60]), pml = pick([0.03, 0.08, 0.15]), pq = pick([0.5, 0.8, 1])
  const lines = ['部品名,型式,数量,回路記号,備考']
  const names: string[] = []
  for (let r = 0; r < nr; r++) {
    const refs = chance(pq) ? `"R${r}, R${r + 100}, R${r + 200}"` : `R${r}`
    let note = ''
    if (chance(pml)) { const k = 2 + int(2); note = '"' + Array.from({ length: k }, (_, i) => (i === 0 || i === k - 1 ? `項目${i}` : Array.from({ length: 1 + int(5) }, (_, j) => `項${j}`).join(', '))).join('\n') + '"' }
    lines.push(`P${r},M-${r},${1 + (r % 5)},${refs},${note}`)
    names.push('P' + r)
  }
  const text = lines.join(chance(0.4) ? '\r\n' : '\n') + '\n'
  const res = parseBomPaste(text)
  const got = res.rows.map((x: any) => x.name)
  const ok = got.length === names.length && got.every((n: string, i: number) => n === names[i])
  const key = `nr${nr}/ml${pml}/q${pq}`
  const s = (stat[key] ??= { n: 0, bad: 0 }); s.n++
  if (!ok) { s.bad++; if (bad.length < 10) bad.push({ key, got: got.length, text: text.slice(0, 400) }) }
}
const tot = Object.values(stat).reduce((a, s) => a + s.n, 0), tb = Object.values(stat).reduce((a, s) => a + s.bad, 0)
console.log('N', tot, 'bad', tb)
for (const [k, v] of Object.entries(stat).sort()) console.log(k, v.bad + '/' + v.n)
for (const b of bad.slice(0, 3)) console.log(JSON.stringify(b).slice(0, 600))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/306-eda-ml' + (process.env.TAG ?? '') + '.json', JSON.stringify({ stat, bad }, null, 1))
