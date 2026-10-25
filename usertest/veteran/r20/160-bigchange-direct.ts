// ラウンド20: 2,500 行の変更表（d1〜d6 の形を 2,500 行に）と普通の表の取り込み時間と行数。現行と r19 ビルド
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const N = Number(process.env.N ?? 2500)
const tab = (rows: Array<Array<string | number>>) => rows.map((r) => r.join('\t')).join('\n') + '\n'
const rep = (f: (k: number) => Array<string | number>) => Array.from({ length: N }, (_, i) => f(i + 1))
const CASES: Array<[string, string, number, string]> = [
  ['d1 copy 1field 57%/13%/30%del', tab([['部品名', '型式', '変更後型式', '数量'], ...rep((k) => [`部品${k}`, `OLD-${k}`, k <= N * 0.57 ? `OLD-${k}` : k <= N * 0.7 ? `NEW-${k}` : '', (k % 7) + 1])]), Math.round(N * 0.7), 'copy; 30% empty → 【削除？】'],
  ['d2 sparse dash 80%', tab([['部品名', '型式', '変更後型式', '数量', '備考'], ...rep((k) => k % 10 === 1 ? [`部品${k}`, `OLD-${k}`, `NEW-${k}`, (k % 7) + 1, '型式変更'] : k % 10 === 2 ? [`部品${k}`, `OLD-${k}`, `OLD-${k}`, (k % 7) + 1, '取付位置変更'] : [`部品${k}`, `OLD-${k}`, '－', (k % 7) + 1, ''])]), N, 'all kept'],
  ['d4 sparse notes', tab([['部品名', '型式', '変更後型式', '数量', '備考'], ...rep((k) => [`部品${k}`, `OLD-${k}`, k % 10 === 1 ? `NEW-${k}` : '', (k % 7) + 1, k % 10 === 5 ? '取外し時注意' : ''])]), N, 'all kept'],
  ['d4b sparse deletion notes 10%', tab([['部品名', '型式', '変更後型式', '数量', '備考'], ...rep((k) => [`部品${k}`, `OLD-${k}`, k % 10 === 1 ? `NEW-${k}` : '', (k % 7) + 1, k % 10 === 5 ? '不要のため削除' : ''])]), N - N / 10, '10% deleted'],
  ['d6 machines sparse', tab([['部品名', '型式', '1号機(旧)', '2号機(旧)', '1号機(新)', '2号機(新)'], ...rep((k) => { const q = (k % 3) + 1; return k % 10 === 1 ? [`部品${k}`, `M-${k}`, q, q, q + 1, q + 1] : [`部品${k}`, `M-${k}`, q, q, '', ''] })]), N, 'qty sum'],
  ['ordinary 5 columns', tab([['部品名', '型式', 'メーカ', '数量', '備考'], ...rep((k) => [`部品${k}`, `M-${k}`, 'オムロン', (k % 7) + 1, k % 9 === 0 ? '取外し時注意' : k % 11 === 0 ? '削除予定' : ''])]), N, 'all kept'],
  ['change sheet w/ 変更内容 and 備考', tab([['部品名', '型式', '変更後型式', '数量', '変更内容', '備考'], ...rep((k) => [`部品${k}`, `OLD-${k}`, k % 10 === 1 ? `NEW-${k}` : '', (k % 7) + 1, k % 10 === 1 ? '型式変更' : '', k % 10 === 5 ? '削除' : ''])]), N - N / 10, '10% deleted by 備考 while 変更内容 exists'],
  ['change sheet 備考 then 変更内容', tab([['部品名', '型式', '変更後型式', '数量', '備考', '変更内容'], ...rep((k) => [`部品${k}`, `OLD-${k}`, k <= N * 0.6 ? (k % 10 === 1 ? `NEW-${k}` : `OLD-${k}`) : '', (k % 7) + 1, '', k % 10 === 2 ? '取付位置変更' : ''])]), Math.round(N * 0.6), 'copy w/ reasons in 変更内容 (right of 備考)'],
]
const out: unknown[] = []
for (const [name, text, expect, note] of CASES) {
  const t0 = performance.now()
  const r = parseBomPaste(text)
  const ms = Math.round(performance.now() - t0)
  const rows = r.rows as any[]
  const rec = { name, kb: Math.round(text.length / 1024), ms, n: rows.length, expect, flagged: rows.filter((x) => String(x.note ?? '').startsWith('【削除？】')).length, qtySum: rows.reduce((a, x) => a + (x.qtyNeeded ?? 0), 0), note, w: r.warnings.map((x) => x.slice(0, 60)) }
  out.push(rec); console.log(JSON.stringify(rec))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r20/160-bigchange-direct' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
