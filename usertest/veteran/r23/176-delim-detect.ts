// ラウンド20: 区切りの判定（タブがあれば TSV、無くてコンマがあれば CSV）の境目: CSV のセルの中にタブ、TSV のセルの中にコンマだけの行が多い、セミコロン区切り
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const CASES: Array<[string, string, string]> = [
  ['D1 CSV の備考のセルにタブ 1 つ（引用符つき）', '部品名,型式,数量,備考\nリレー,MY4N,4,"盤内\t上段"\n端子台,XW2B,2,\n', '2 部品（コンマ区切り）'],
  ['D2 CSV の備考のセルにタブ 1 つ（引用符なし）', '部品名,型式,数量,備考\nリレー,MY4N,4,盤内\t上段\n端子台,XW2B,2,\n', '2 部品'],
  ['D3 CSV の部品名の末尾にタブ', '部品名,型式,数量\nリレー\t,MY4N,4\n端子台,XW2B,2\n', '2 部品'],
  ['D4 TSV で各セルにコンマ（回路記号 R1, R2）', '部品名\t型式\t数量\t回路記号\nリレー\tMY4N\t4\tK1, K2\n端子台\tXW2B\t2\tTB1, TB2\n', '2 部品'],
  ['D5 セミコロン区切り', '部品名;型式;数量\nリレー;MY4N;4\n端子台;XW2B;2\n', '2 部品（セミコロン区切りも読むか、読めないと知らせる）'],
  ['D6 パイプ区切り', '部品名|型式|数量\nリレー|MY4N|4\n端子台|XW2B|2\n', '2 部品か知らせる'],
  ['D7 全角コンマ区切り', '部品名，型式，数量\nリレー，MY4N，4\n端子台，XW2B，2\n', '2 部品か知らせる'],
  ['D8 半角空白 2 つ以上の区切り（PDF からのコピー）', '部品名  型式  数量\nリレー  MY4N  4\n端子台  XW2B  2\n', '2 部品か知らせる'],
]
const out: unknown[] = []
for (const [id, text, expect] of CASES) {
  const r = parseBomPaste(text)
  const rec = { id, expect, n: r.rows.length, delimiter: r.delimiter, mapping: r.mapping.join(','), rows: (r.rows as any[]).map((x) => [x.name, x.model, x.qtyNeeded, x.note ?? ''].join(' / ')), warnings: r.warnings.map((w) => w.slice(0, 80)) }
  out.push(rec); console.log(JSON.stringify(rec))
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/176-delim-detect' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
