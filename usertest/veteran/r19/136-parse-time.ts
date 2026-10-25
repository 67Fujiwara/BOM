// ラウンド18: 2,500 行の取り込みの時間（現行 / r17 ビルド）。Excel の CSV（全部の行の備考を囲む・10 行ごとに複数行）、囲まない「"」の多い .csv、タブ区切り
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const N = 2500
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const T: Record<string, string> = {
  csvQuotedAll: ['部品名,型式,メーカ,数量,備考', ...Array.from({ length: N }, (_, i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i % 9 + 1), q(i % 10 === 0 ? `盤内 ${i}\n要確認` : `備考 ${i}, A`)].join(','))].join('\r\n'),
  csvRawDitto: ['部品名,型式,メーカ,数量', ...Array.from({ length: N }, (_, i) => [`部品${i}`, `M-${i}`, i % 2 ? '"' : 'オムロン', String(i % 9 + 1)].join(','))].join('\n'),
  tsvPlain: ['部品名\t型式\tメーカ\t数量', ...Array.from({ length: N }, (_, i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i % 9 + 1)].join('\t'))].join('\n'),
  csvUnclosed: ['部品名,型式,メーカ,数量', ...Array.from({ length: N }, (_, i) => [`"部品${i}`, `M-${i}`, 'オムロン', String(i % 9 + 1)].join(','))].join('\n'),
}
const out: Record<string, unknown> = {}
for (const [k, t] of Object.entries(T)) {
  const ms: number[] = []
  let n = 0
  for (let r = 0; r < 5; r++) { const t0 = performance.now(); n = parseBomPaste(t).rows.length; ms.push(Math.round(performance.now() - t0)) }
  ms.sort((a, b) => a - b)
  out[k] = { rows: n, medMs: ms[2], ms }
  console.log(k, JSON.stringify(out[k]))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r19/136-parse-time' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
