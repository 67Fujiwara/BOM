// ラウンド23: 見つけた形を .xlsx / .csv / .tsv でガイドに取り込む（310-probe.ts は同じ形を parseBomPaste で直接）
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1))
const kind = (id, note, h, vals, expect) => ({ id, note, expect, rows: [[h, '部品名', '型式', '数量'], ...vals.map((v, i) => [v, `P${i}`, `M-${i}`, 1])] })
export const SHAPES = [
  { id: 'N01-dnp-bracket-maker', note: '備考に「DNP(大日本印刷)製」（メーカの説明）', expect: '2 部品', rows: [['部品名', '型式', '数量', '備考'], ['A', 'M-1', 1, 'DNP(大日本印刷)製'], ['B', 'M-2', 1, '']] },
  { id: 'N02-dnp-bracket-compare', note: '備考に「DNP（凸版比較）」', expect: '2 部品', rows: [['部品名', '型式', '数量', '備考'], ['A', 'M-1', 1, 'DNP（凸版比較）'], ['B', 'M-2', 1, '']] },
  { id: 'N03-dnp-bracket-sumi', note: '備考に「DNP【反射】」「DNP[1]」', expect: '3 部品', rows: [['部品名', '型式', '数量', '備考'], ['A', 'M-1', 1, 'DNP【反射】'], ['B', 'M-2', 1, 'DNP[1]'], ['C', 'M-3', 1, '']] },
  { id: 'N04-dnp-trail-mark', note: '実装しない印の後ろの記号「未実装※」「DNP*」「未実装*」（前の記号は外すが後ろは外さない）', expect: '「未実装※」「DNP*」は実装しない=C のみ…（少なくとも前後で対称）', rows: [['部品名', '型式', '数量', '備考'], ['A', 'M-1', 1, '未実装※'], ['B', 'M-2', 1, 'DNP*'], ['C', 'M-3', 1, '※未実装'], ['D', 'M-4', 1, '*DNP']] },
  kind('K01-seg-maru', '変更区分に ○/×（部品の可否）', '変更区分', ['○', '×', '○', '×'], '4 部品'),
  kind('K02-taiou-kubun-yofuyo', '対応区分に 要/不要/済', '対応区分', ['要', '不要', '済', '要'], '4 部品'),
  kind('K03-status-eol', 'ステータスに 使用中/廃止/新規/使用中', 'ステータス', ['使用中', '廃止', '新規', '使用中'], '4 部品（廃止＝EOL 品は部品）'),
  kind('K04-koushin-x', '更新区分に x/-（更新した/しない）', '更新区分', ['x', '-', 'x', '-'], '4 部品'),
  kind('K05-kubun-shinki-haishi', '区分に 新規/流用/廃止（購入区分）', '区分', ['新規', '流用', '廃止', '新規'], '4 部品'),
  kind('K06-sehen-kubun-D', '設変区分に A/B/C/D（ランク）', '設変区分', ['A', 'B', 'C', 'D'], '4 部品'),
]
const eda = (nr, pml) => {
  const L = ['部品名,型式,数量,回路記号,備考']
  for (let r = 0; r < nr; r++) {
    const note = r % Math.round(1 / pml) === 1 ? '"項目0\n項1, 項2, 項3\n項目2"' : ''
    L.push(`P${r},M-${r},${1 + (r % 5)},"R${r}, R${r + 100}, R${r + 200}",${note}`)
  }
  return L.join('\n') + '\n'
}
export const TEXTS = [
  { id: 'E01-eda-csv-ml-30', note: 'EDA 風 CSV: 回路記号を全行引用符で囲み、備考の 3 行セルが 30 行中 5 行（中の行にコンマ 3 つ）', expect: '30 部品', delim: 'csv', text: eda(30, 0.15) },
  { id: 'E02-eda-csv-ml-60', note: '同 60 行中 8 行', expect: '60 部品', delim: 'csv', text: eda(60, 0.13) },
  { id: 'E03-eda-csv-ml-8', note: '同 8 行中 2 行', expect: '8 部品', delim: 'csv', text: eda(8, 0.25) },
  { id: 'Q01-ditto-inch-ml', note: '〃の「"」＋インチ＋複数行セル（コンマ 5）が 1 行に', expect: '2 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\n部品0,M-0,オムロン,0,\n",3/4",オムロン,1,"項目0, 項目1, 項目2, 項目3, 項目4\n続き"\n' },
  { id: 'H06-tsv-comma-header-title', note: 'TSV(見出し無し)の 1 行目が「部品名, 型式, 数量」', expect: '10 部品', delim: 'tsv', text: ['部品名, 型式, 数量', ...rep(10, (i) => `部品${i}\tM-${i}\t1\tR${i}0, R${i}1, R${i}2, R${i}3`)].join('\n') + '\n' },
]
