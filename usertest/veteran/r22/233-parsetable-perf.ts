// ラウンド22: parseTable / 区切りの決め方（2 回 parse）の時間（CPU）。1 行に「"」だけのセルが多い行、行数の多い TSV（コンマ入り）、CSV（タブ入り）、
// 引用符の閉じない行、2,500 / 10,000 / 40,000 行。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, parseTable } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const cpu = (f: () => unknown) => { const c0 = process.cpuUsage(); const r = f(); const c = process.cpuUsage(c0); return { ms: Math.round((c.user + c.system) / 1000), r } }
const out: any[] = []
const rec = (id: string, text: string, fn: 'bom' | 'table') => {
  const { ms, r } = cpu(() => (fn === 'bom' ? parseBomPaste(text) : parseTable(text, text.includes('\t') ? '\t' : ',')))
  const n = fn === 'bom' ? (r as any).rows.length : (r as any[]).length
  out.push({ id, len: text.length, fn, ms, n }); console.log(`${id} len=${text.length} ${fn} ${ms}ms n=${n}`)
}
const hdr = '部品名,型式,メーカ,数量,備考'
for (const m of [2500, 5000, 10000, 20000, 40000]) {
  // 1 行に「"」だけのセルが m 個（幅の合わない行）
  rec(`ditto-line m=${m}`, [hdr, 'A,M-1,オム,1,', Array(m).fill('"').join(','), 'B,M-2,オム,2,'].join('\n'), 'table')
  rec(`ditto-line-bom m=${m}`, [hdr, 'A,M-1,オム,1,', Array(m).fill('"').join(','), 'B,M-2,オム,2,'].join('\n'), 'bom')
  // 1 行に ,",x", のようなコンマで始まる囲みが m 個
  rec(`commaquote-line m=${m}`, [hdr, 'A,M-1,オム,1,', Array(m).fill('",x"').join(','), 'B,M-2,オム,2,'].join('\n'), 'table')
}
for (const rows of [2500, 10000, 40000]) {
  const mk = (d: string, refs: number) => ['部品名', '型式', '員数', '回路記号'].join(d) + '\n' + Array.from({ length: rows }, (_, i) => [`部品${i}`, `M-${i}`, '1', Array.from({ length: refs }, (_, k) => 'R' + k).join(d === '\t' ? ', ' : '\t')].join(d)).join('\n')
  rec(`tsv refs=2 rows=${rows}`, mk('\t', 2), 'bom')
  rec(`tsv refs=5 rows=${rows}`, mk('\t', 5), 'bom')
  rec(`csv tabs=5 rows=${rows}`, mk(',', 5), 'bom')
  // 引用符つきの複数行（Excel の TSV）
  rec(`tsv-ml rows=${rows}`, ['部品名', '型式', '員数', '備考'].join('\t') + '\n' + Array.from({ length: rows }, (_, i) => [`部品${i}`, `M-${i}`, '1', '"a, b\nc, d\ne"'].join('\t')).join('\n'), 'bom')
  // 閉じない引用符が 10% の行にある
  rec(`csv-open-quote rows=${rows}`, hdr + '\n' + Array.from({ length: rows }, (_, i) => [`部品${i}`, `M-${i}`, 'オム', '1', i % 10 ? '' : '"未完'].join(',')).join('\n'), 'bom')
  rec(`csv-inch rows=${rows}`, hdr + '\n' + Array.from({ length: rows }, (_, i) => [`パイプ 3/4"`, `M-${i}`, 'オム', '1', i % 2 ? '"' : ''].join(',')).join('\n'), 'bom')
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/233-parsetable-perf' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
