// ラウンド20（4 つ目）: 区切りの判定（CSV のセルの中のタブ）
export const SHAPES = []
export const TEXTS = [
  { id: 'D1-csv-tab-in-quoted-cell', note: 'CSV の備考のセルにタブ 1 つ（引用符つき）', expect: '2 部品（コンマ区切りとして読む）', delim: 'csv', text: '部品名,型式,数量,備考\nリレー,MY4N,4,"盤内\t上段"\n端子台,XW2B,2,\n' },
  { id: 'D2-csv-tab-in-cell', note: 'CSV の備考のセルにタブ 1 つ（引用符なし）', expect: '2 部品', delim: 'csv', text: '部品名,型式,数量,備考\nリレー,MY4N,4,盤内\t上段\n端子台,XW2B,2,\n' },
  { id: 'D3-csv-trailing-tab-in-name', note: 'CSV の部品名の末尾にタブ', expect: '2 部品', delim: 'csv', text: '部品名,型式,数量\nリレー\t,MY4N,4\n端子台,XW2B,2\n' },
  { id: 'D9-csv-many-rows-one-tab', note: 'CSV 300 行のうち 1 行の備考にタブ', expect: '300 部品', delim: 'csv', text: '部品名,型式,数量,備考\n' + Array.from({ length: 300 }, (_, i) => `部品${i + 1},M-${i + 1},${(i % 7) + 1},${i === 149 ? '盤内\t上段' : ''}`).join('\n') + '\n' },
]
