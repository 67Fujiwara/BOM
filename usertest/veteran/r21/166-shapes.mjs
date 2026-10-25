// ラウンド20（3 つ目）: DNP の語の周り・Altium の Comment/Value/Description の三つ組・数量の言い方
export const SHAPES = [
  { id: 'DP4-dnp-note-words', note: '備考「DNP 手配」「DNP 品」「DNP製」「DNP (大日本印刷)」「※DNP 手配」「DNP」', expect: '備考に DNP の語が入っていても実装しない部品とは限らない（手配先メモ）。「DNP」だけの行は外す', rows: [['部品名', '型式', '数量', '備考'], ['A', 'M-1', 1, 'DNP 手配'], ['B', 'M-2', 1, 'DNP 品'], ['C', 'M-3', 1, 'DNP製'], ['D', 'M-4', 1, 'DNP (大日本印刷)'], ['E', 'M-5', 1, '※DNP 手配'], ['F', 'M-6', 1, 'DNP']] },
  { id: 'DP5-dnp-model', note: '型式「DNP RF-100」「DNP-200」「DNP 200」', expect: '3 部品（型式の DNP は大日本印刷）', rows: [['部品名', '型式', '数量'], ['A', 'DNP RF-100', 1], ['B', 'DNP-200', 1], ['C', 'DNP 200', 1]] },
  { id: 'AL4-altium-three-names', note: 'Description・Value・Comment の 3 つ。Description も Value も空で Comment だけ値', expect: '部品名は Comment (LM358)', rows: [['Description', 'Value', 'Comment', 'Designator', 'Quantity'], ['Capacitor', '100nF', '100nF', 'C1', 2], ['', '', 'LM358', 'U1', 1], ['', '10k', '10k', 'R1', 1]] },
  { id: 'AL5-altium-comment-only-then-desc', note: 'Comment が先、Description が後で、Description が空の行は Comment', expect: '部品名は Comment', rows: [['Comment', 'Description', 'Designator', 'Quantity'], ['LM358', '', 'U1', 1], ['100nF', 'Capacitor', 'C1', 2]] },
  { id: 'AL6-altium-comment-with-note-col', note: 'Comment・Description・備考（日本語）。Description 空の行', expect: '部品名は Comment、備考はそのまま', rows: [['Comment', 'Description', '備考', 'Designator', 'Quantity'], ['LM358', '', '要予備', 'U1', 1], ['100nF', 'Capacitor', '', 'C1', 2]] },
  { id: 'QT30-suryo-tehai-kana', note: '「数量」と「手配数」が両方あり数量が空の行', expect: '空の数量は 0 と知らせる（手配数 100 を使わない）', rows: [['部品名', '型式', '数量', '手配数'], ['A', 'M-1', 3, 100], ['B', 'M-2', '', 50]] },
  { id: 'QT31-insu-daisu-product', note: '「員数」×「台数」の表で台数が全行「3」、員数が空の行', expect: '員数が空の行は 0 と知らせる', rows: [['部品名', '型式', '員数', '台数'], ['A', 'M-1', 2, 3], ['B', 'M-2', '', 3]] },
  { id: 'QT32-total-and-per-unit', note: '「1台当り数量」と「合計数量」と「予備」', expect: '合計数量（予備を含むかは知らせる）', rows: [['部品名', '型式', '1台当り数量', '予備', '合計数量'], ['A', 'M-1', 2, 1, 7], ['B', 'M-2', 1, 0, 3]] },
]
export const TEXTS = []
