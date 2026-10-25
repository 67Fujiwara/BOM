// ラウンド23: 区切りの決め方で parseTable を最大 5 回呼ぶ形（両方の区切りで見出しが見える）の CPU 時間。2,500 / 10,000 / 40,000 行
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, parseTable } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const refs = (i: number, k: number) => Array.from({ length: k }, (_, j) => `R${i * 10 + j}`).join(', ')
const mk = (n: number, kind: string) => {
  const L: string[] = []
  if (kind === 'both-hit') L.push('品名, 数量, 納期')
  if (kind === 'both-hit') L.push('部品名\t型式\t数量\t回路記号\t備考')
  else if (kind === 'tsv-plain') L.push('部品名\t型式\t数量\t回路記号\t備考')
  else L.push('部品名,型式,数量,回路記号,備考')
  for (let i = 1; i <= n; i++) {
    if (kind === 'csv-quoted') L.push(`部品${i},M-${i},1,"${refs(i, 4)}",${i % 20 === 0 ? '"a, b\nc, d"' : ''}`)
    else L.push(['部品' + i, 'M-' + i, '1', refs(i, 4), i % 20 === 0 ? '備考, あ' : ''].join('\t'))
  }
  return L.join('\n') + '\n'
}
const out: any[] = []
for (const kind of ['tsv-plain', 'both-hit', 'csv-quoted']) for (const n of [2500, 10000, 40000]) {
  const text = mk(n, kind)
  const c0 = process.cpuUsage(); const r = parseBomPaste(text); const c1 = process.cpuUsage(c0)
  const c2 = process.cpuUsage(); parseTable(text, kind === 'csv-quoted' ? ',' : '\t'); const c3 = process.cpuUsage(c2)
  const rec = { kind, n, len: text.length, rows: r.rows.length, delim: r.delimiter, bomMs: Math.round((c1.user + c1.system) / 1000), oneParseMs: Math.round((c3.user + c3.system) / 1000) }
  out.push(rec); console.log(JSON.stringify(rec))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/318-parse-5x' + (process.env.TAG ?? '') + '.json', JSON.stringify(out))
