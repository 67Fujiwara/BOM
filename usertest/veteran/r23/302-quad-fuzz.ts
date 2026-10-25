// ラウンド23: parseTable / parseBomPaste が行の長さ・引用符・区切りの数に対して線形か。トークンの混合を乱数で作り n=8,000 で測り、遅いものを n=32,000 で測り直す（4 倍で 16 倍なら二乗）
import fs from 'node:fs'
import { parseTable, parseBomPaste, rng } from './h22.ts'
const { pick, chance, int, rnd } = rng(Number(process.env.SEED ?? 23))
const TOK = ['"', '""', '",', ',', '\t', '\n', 'a', 'ab', ' ', '　', '",x"', '"\n', '\n"', '3/4"', '(', ')', '）', '→', '"\t', '\t"', '""",', 'x,', ',"', '削除', '（', '部品名', '数量,', 'R1, R2']
const cpu = (f: () => void) => { const a = process.cpuUsage(); f(); const b = process.cpuUsage(a); return (b.user + b.system) / 1000 }
const gen = (w: number[], n: number) => {
  const tot = w.reduce((a, b) => a + b, 0)
  let s = '部品名,型式,数量\n部品1,M1,1\n'
  while (s.length < n) { let x = rnd() * tot, i = 0; while (x > w[i]) { x -= w[i]; i++ } s += TOK[i] }
  return s + '\n部品2,M2,2\n'
}
const results: any[] = []
const M = Number(process.env.M ?? 60)
for (let t = 0; t < M; t++) {
  const w = TOK.map(() => (chance(0.4) ? 0 : chance(0.3) ? 10 : 1))
  if (!w.some((x) => x)) continue
  for (const fn of ['table,', 'table\t', 'bom']) {
    const t1 = (() => { const s = gen(w, 8000); return cpu(() => (fn === 'bom' ? parseBomPaste(s) : parseTable(s, fn[5] as any))) })()
    if (t1 > 40) {
      const s2 = gen(w, 32000)
      const t2 = cpu(() => (fn === 'bom' ? parseBomPaste(s2) : parseTable(s2, fn[5] as any)))
      results.push({ t, fn, w: TOK.filter((_, i) => w[i]).map((x, i) => x), t8k: Math.round(t1), t32k: Math.round(t2), ratio: +(t2 / t1).toFixed(1), toks: TOK.map((x, i) => (w[i] ? `${JSON.stringify(x)}x${w[i]}` : '')).filter(Boolean).join(' ') })
      console.log(JSON.stringify(results[results.length - 1]).slice(0, 400))
    }
  }
}
console.log('done', M, 'mixes; slow(>40ms@8k):', results.length, 'superlinear(ratio>8):', results.filter((r) => r.ratio > 8).length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/302-quad-fuzz' + (process.env.TAG ?? '') + '.json', JSON.stringify(results, null, 1))
