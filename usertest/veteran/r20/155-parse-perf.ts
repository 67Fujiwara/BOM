// ラウンド20: 引用符まわりの解析時間（closesProperly は「"」ごとに次の「"」まで走査する）。現行と r19 ビルドで ms を比べる
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, parseTable } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const H = '部品名,型式,メーカ,数量'
const rep = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i + 1)).join('\n')
const N = Number(process.env.N ?? 2500)
const CASES: Array<[string, string]> = [
  ['P1 開く「"」が各行・最後の行に閉じる「"」', `${H}\n${rep(N, (i) => `"特注品${i},M-${i},オムロン,1`)}\n終わり",X,オムロン,1\n`],
  ['P2 〃の「"」が毎行（短い）', `${H}\n${rep(N, (i) => `部品${i},M-${i},",1`)}\n`],
  ['P3 最後の列の「"」が毎行', `部品名,型式,数量,備考\n${rep(N, (i) => `部品${i},M-${i},1,"`)}\n`],
  ['P4 先頭の列の「"」が毎行 + 最後の行に閉じる', `${H}\n${rep(N, (i) => `",M-${i},オムロン,1`)}\n x",A,B,1\n`],
  ['P5 複数行のセルが毎行（中にコンマ 5）', `部品名,型式,数量,備考\n${rep(N, (i) => `部品${i},M-${i},1,"a, b, c, d, e\nf, g"`)}\n`],
  ['P6 普通の 10,000 行', `${H}\n${rep(10000, (i) => `部品${i},M-${i},オムロン,${(i % 7) + 1}`)}\n`],
  ['P7 「"」だけの行が N 行（1 列）', `型式\n${rep(N, () => '"')}\n`],
  ['P8 開く「"」が毎行のタブ区切り + 最後に閉じる', `部品名\t型式\tメーカ\t数量\n${rep(N, (i) => `"特注品${i}\tM-${i}\tオムロン\t1`)}\n終わり"\tX\tオムロン\t1\n`],
  ['P9 開く「"」が毎行で 1 列（コンマなし）', `部品名\n${rep(N, (i) => `"特注品${i}`)}\n終わり"\n`],
  ['P10 ""（空文字の囲み）が毎行', `${H}\n${rep(N, (i) => `部品${i},"""",オムロン,1`)}\n`],
]
const out: unknown[] = []
for (const [name, text] of CASES) {
  const t0 = performance.now()
  let n = -1, err = ''
  try { n = parseBomPaste(text).rows.length } catch (e: any) { err = String(e?.message ?? e).slice(0, 80) }
  const ms = Math.round(performance.now() - t0)
  out.push({ name, kb: Math.round(text.length / 1024), ms, rows: n, err })
  console.log(JSON.stringify({ name, kb: Math.round(text.length / 1024), ms, rows: n, err }))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r20/155-parse-perf' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
