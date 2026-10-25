// ラウンド23 n10: 大きな貼り付け（コンマもタブも含む）の取り込み時間。旧 68e45f7 と新
import fs from 'node:fs'
import { loadParsers } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const mk = (n, kind) => {
  const L = ['品名\t型式\t回路記号\t数量\t備考']
  for (let i = 0; i < n; i++) {
    if (kind === 'commas') L.push(`抵抗${i}\tR-${i}\tR1,R2,R3,R4,R5,R6,R7\t7\t削除（確認中のため）`)
    else if (kind === 'quotes') L.push(`"抵抗${i}\nA"\t"R-${i}"\t"R1,R2,R3"\t7\t"盤内\t上段"`)
    else if (kind === 'notes') L.push(`抵抗${i}\tR-${i}\tR1\t7\t${['', '位置変更あり', 'DNP 将来用', '削除（保留）', '代替品あり'][i % 5]}`)
    else L.push(`抵抗${i}\tR-${i}\tR1\t7\t`)
  }
  return L.join('\n')
}
const out = []
for (const kind of ['plain', 'commas', 'quotes', 'notes']) for (const n of [1000, 5000, 20000]) {
  const t = mk(n, kind)
  const tm = (p) => { const s = performance.now(); const r = p.parseBomPaste(t); return [Math.round(performance.now() - s), r.rows.length] }
  const a = tm(old), b = tm(neu)
  out.push(`${kind} ${n}行 old=${a[0]}ms(${a[1]}行) new=${b[0]}ms(${b[1]}行)`)
  console.log(out.at(-1))
}
// 病的：200KB 1 行・引用符だらけ・括弧だらけ
const path = { 'quote-comma 200KB': '"a",' .repeat(50000), 'paren 80k': '削除' + '（'.repeat(80000), 'close 80k': '品名\t備考\nx\t削除（' + '）'.repeat(80000), 'spaces 80k': '品名\t備考\nx\t' + ' '.repeat(80000) + '削除', 'dnp marks 80k': '品名\t備考\nx\t' + '※'.repeat(80000) + 'DNP', 'arrow 80k': '品名\t型式\nx\t' + 'A→'.repeat(40000) + 'B' }
for (const [k, t] of Object.entries(path)) {
  const tm = (p) => { const s = performance.now(); try { p.parseBomPaste(t) } catch (e) { return 'EXC ' + String(e).slice(0, 40) } return Math.round(performance.now() - s) + 'ms' }
  out.push(`path ${k} old=${tm(old)} new=${tm(neu)}`)
  console.log(out.at(-1))
}
fs.writeFileSync('results/n10_perf.out', out.join('\n') + '\n')
