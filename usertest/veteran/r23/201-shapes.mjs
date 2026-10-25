// ラウンド21: ラウンド20 の修正（区切りの多数決・囲みの外の数え・削除の 3 分類・矢印・号機・変更区分・SAME）の境目。
// 201-header-probe.ts（vite-node で現行 56e5aba と r20 ビルド 688ceb6 の parseBomPaste を直接）と 201-header-wizard.mjs（.xlsx / .csv / .tsv をガイドで）で共通
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1))
const T = (rows) => rows.map((r) => r.join('\t')).join('\n')
const HDR = ['部品名', '型式', 'メーカ', '数量', '備考']
const titles = (n) => Array.from({ length: n }, (_, i) => ['部品表', '制御盤A', '2026-10-25', '作成 山田', '承認 鈴木', 'Rev.2', '客先 X', '図番 D-100', '納期 12月', '備考欄'][i % 10])
const parts = (n, ml) => rep(n, (i) => [`部品${i}`, `M-${i}`, i % 2 ? 'Omron, Inc.' : 'オムロン', String(i), ml ? '"1行目\n2行目\n3行目"' : ''])
const HC = ['部品名', '旧型式', '新型式', '数量', '備考']
const sparse = (notes, wh = 'note') => [HC, ['基準A', 'MY2N', 'MY4N', 1, '型式変更'], ['基準B', 'XA-1', 'XA-2', 2, '型式変更'], ...notes.map((n, i) => [`N${String(i + 1).padStart(2, '0')}`, `ZZ-${i + 1}`, wh === 'model' ? n : '', 3, wh === 'note' ? n : '']), ['基準D', 'Q-1', '', 5, '']]
export const SHAPES = [
  { id: 'W22-newmodel-ask-words', note: '新型式の列に「削除？」「削除に変更」「Del?」「削除予定」「要削除？」「削除検討」', expect: '型式にしない（削除か保留かを知らせる）', rows: [['部品名', '旧型式', '新型式', '数量'], ['基準A', 'MY2N', 'MY4N', 1], ...['削除？', '削除に変更', 'Del?', '削除予定', '要削除？', '削除検討'].map((v, i) => [`N${i + 1}`, `ZZ-${i + 1}`, v, 1])] },
  { id: 'W23-machines-order', note: '号機の変更表。列の並びが 旧1・旧2・新2・新1。旧1=6・旧2=2・新2=9・新1 空', expect: '15（旧1 6 ＋ 新2 9）', rows: [['部品名', '型式', '旧1号機', '旧2号機', '新2号機', '新1号機'], ['リレー', 'MY4N', 6, 2, 9, ''], ['端子台', 'XW2B', 1, 1, '', '']] },
  { id: 'W19a-kind-col-maru-batsu', note: '普通の表の「変更」の列に ○（変更あり）/ ×（変更なし）', expect: '4 部品（× の行も部品）', rows: [['変更', '部品名', '型式', '数量'], ['○', 'A', 'M-1', 1], ['×', 'B', 'M-2', 1], ['○', 'C', 'M-3', 1], ['×', 'D', 'M-4', 1]] },
  { id: 'W19b-kind-col-youfuyou', note: '普通の表の「変更」の列に 要 / 不要（変更要否）', expect: '4 部品', rows: [['変更', '部品名', '型式', '数量'], ['要', 'A', 'M-1', 1], ['不要', 'B', 'M-2', 1], ['要', 'C', 'M-3', 1], ['不要', 'D', 'M-4', 1]] },
  { id: 'W19c-kind-col-henkou-kubun-maru', note: '「変更区分」の列に ○ / ×', expect: '4 部品', rows: [['変更区分', '部品名', '型式', '数量'], ['○', 'A', 'M-1', 1], ['×', 'B', 'M-2', 1], ['○', 'C', 'M-3', 1], ['×', 'D', 'M-4', 1]] },
  { id: 'W03-xlsx-title10-comma', note: 'xlsx: 表題 10 行＋見出し＋8 行、メーカに「Omron, Inc.」', expect: '8 部品（部品名は 部品1〜8）', rows: [...titles(10).map((t) => [t]), HDR, ...parts(8, false).map((r) => r.map((c) => c))] },
  { id: 'W04-xlsx-name-only-rows', note: 'xlsx: 部品名だけの行が 2/3、残りにメーカ「Omron, Inc.」', expect: '12 部品', rows: [HDR, ...rep(12, (i) => (i % 3 ? [`部品${i}`] : [`部品${i}`, `M-${i}`, 'Omron, Inc.', 1]))] },
  { id: 'W08-note-paren-negated', note: '変えた行だけ書く表。備考の括弧の中が否定・例外: 削除（予定なし）・削除（対象外）・削除（変更なし）・削除（盤は残す）・削除（Rev.2では残す）・撤去（予定なし）・削除（未完了）', expect: '残す 7 部品＋基準 3＝10 部品（どれも削除しない）', rows: sparse(['削除（予定なし）', '削除（対象外）', '削除（変更なし）', '削除（盤は残す）', '削除（Rev.2では残す）', '撤去（予定なし）', '削除（未完了）']) },
  { id: 'W09-note-del-miss', note: '備考: 削除（不要）・不要の為削除・不要に付き削除・全削除・一式削除・削除確定・削除決定・削除対象', expect: '削除と読む（基準 3 部品だけ残る）。【削除？】でも可', rows: sparse(['削除（不要）', '不要の為削除', '不要に付き削除', '全削除', '一式削除', '削除確定', '削除決定', '削除対象']) },
  { id: 'W10-note-keep-noise', note: '備考の普通の注記: 取外し可能・撤去スペース確保・廃止品番に注意・削除ではない・取外し箇所は図面参照・撤去履歴あり・取外し治具', expect: '10 部品、【削除？】は付かない', rows: sparse(['取外し可能', '撤去スペース確保', '廃止品番に注意', '削除ではない', '取外し箇所は図面参照', '撤去履歴あり', '取外し治具']) },
  { id: 'W11-machines-old3-new2', note: '号機の変更表。旧1・旧2・旧3・新1・新2（新3の列なし）。新1だけ 7、新2 空。旧は 6・6・6', expect: '19（7＋6＋6）', rows: [['部品名', '型式', '旧1号機', '旧2号機', '旧3号機', '新1号機', '新2号機'], ['リレー', 'MY4N', 6, 6, 6, 7, ''], ['端子台', 'XW2B', 1, 1, 1, '', '']] },
  { id: 'W12-machines-unit-oldnew', note: '号機の変更表。旧Unit1・旧Unit2・新Unit1・新Unit2。新1だけ 7', expect: '13（7＋6）', rows: [['部品名', '型式', '旧Unit1', '旧Unit2', '新Unit1', '新Unit2'], ['リレー', 'MY4N', 6, 6, 7, ''], ['端子台', 'XW2B', 1, 1, '', '']] },
  { id: 'W13-kind-vocab', note: '変更区分の値: Del.・削・取外し・全削除・X・✗・削除（Rev.2）・Rev.2削除・削除予定。追加・変更が各 1', expect: '追加・変更の 2 部品。ほかは削除（削除予定は判断）', rows: [['変更区分', '部品名', '型式', '数量'], ['追加', 'A1', 'M-1', 1], ['変更', 'A2', 'M-2', 1], ...['Del.', '削', '取外し', '全削除', 'X', '✗', '削除（Rev.2）', 'Rev.2削除', '削除予定'].map((k, i) => [k, `D${i + 1}`, `DM-${i + 1}`, 1])] },
  { id: 'W14a-kind-header-sehen', note: '見出し「設変区分」に 追加・変更・削除', expect: '削除の行は取り込まない（2 部品）', rows: [['設変区分', '部品名', '型式', '数量'], ['追加', 'A1', 'M-1', 1], ['変更', 'A2', 'M-2', 1], ['削除', 'D1', 'DM-1', 1]] },
  { id: 'W14b-kind-header-change', note: '見出し「Change」に Add・Chg・Delete', expect: '削除の行は取り込まない（2 部品）', rows: [['Change', 'Item', 'Part No', 'Qty'], ['Add', 'A1', 'M-1', 1], ['Chg', 'A2', 'M-2', 1], ['Delete', 'D1', 'DM-1', 1]] },
  { id: 'W14c-kind-header-taiou', note: '見出し「対応」に 追加・変更・削除', expect: '削除の行は取り込まない（2 部品）', rows: [['対応', '部品名', '型式', '数量'], ['追加', 'A1', 'M-1', 1], ['変更', 'A2', 'M-2', 1], ['削除', 'D1', 'DM-1', 1]] },
  { id: 'W14d-kind-header-kubun-with-shusei', note: '見出し「区分」に 追加・変更・削除・修正（修正は語に無い）', expect: '削除の行は取り込まない（3 部品）', rows: [['区分', '部品名', '型式', '数量'], ['追加', 'A1', 'M-1', 1], ['変更', 'A2', 'M-2', 1], ['修正', 'A3', 'M-3', 1], ['削除', 'D1', 'DM-1', 1]] },
  { id: 'W15-same-words2', note: '変えた行だけ書く表。新型式の「（変更なし）」「【変更なし】」「変更なし。」「継続使用」「流用」「前回同様」「従来通り」「現行通り」「変更不要」', expect: '型式は旧のまま', rows: [HC, ['リレー', 'MY2N', 'MY4N', 2, ''], ...['（変更なし）', '【変更なし】', '変更なし。', '継続使用', '流用', '前回同様', '従来通り', '現行通り', '変更不要'].map((v, i) => [`K${i + 1}`, `KM-${i + 1}`, v, 1, ''])] },
  { id: 'W16-arrow-ordinary', note: '普通の BOM（旧／新なし）の型式に変換品「RS485→USB」「USB-A->USB-C」「D-sub9→USB」「HDMI→VGA」「PLC→HMI」「SS400→SUS304」。数量に「3個→5個」', expect: '型式はそのまま（右半分にしない）', rows: [['部品名', '型式', 'メーカ', '数量'], ['変換器1', 'RS485→USB', 'A社', 1], ['ケーブル', 'USB-A->USB-C', 'B社', 1], ['変換器2', 'D-sub9→USB', 'C社', 1], ['変換器3', 'HDMI→VGA', 'D社', 1], ['ゲートウェイ', 'PLC→HMI', 'E社', 1], ['材料', 'SS400→SUS304', 'F社', '3個→5個']] },
  { id: 'W17-note-henkounaiyou-del', note: '変更表。備考と変更内容の 2 列。削除の行は変更内容に「削除」、備考は別の注記', expect: '削除の行は取り込まない（2 部品）', rows: [['部品名', '旧型式', '新型式', '数量', '備考', '変更内容'], ['A', 'M-1', 'N-1', 1, '盤内', '型式変更'], ['B', 'M-2', '', 1, '', '削除'], ['C', 'M-3', '', 1, '要予備', '']] },
]
export const TEXTS = [
  { id: 'W21a-csv-ditto-all-consecutive', note: 'CSV: 部品名・型式・メーカが「"」（囲まない。〃の代わり）の行が 2 行続く', expect: '3 部品（2 行とも リレー MY4N オムロン）', delim: 'csv', text: '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\n",",",2\n",",",3\n' },
  { id: 'W21b-csv-ditto-maker-then-ditto-model-maker', note: 'CSV: メーカが「"」の行の次の行が 型式・メーカとも「"」', expect: '3 部品', delim: 'csv', text: '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nタイマ,H3CR,",2\nソケット,",",3\n' },
  { id: 'W21c-csv-ditto-all-300rows', note: 'CSV: 300 行。3 行に 1 行は 部品名・型式・メーカが「"」の行（連続しない）', expect: '300 部品', delim: 'csv', text: ['部品名,型式,メーカ,数量', ...Array.from({ length: 300 }, (_, i) => (i % 3 === 1 ? `",",",${i}` : `部品${i},M-${i},オムロン,${i}`))].join('\n') + '\n' },
  { id: 'W21d-csv-ditto-all-300rows-pairs', note: 'CSV: 300 行。3 行に 2 行は「"」だけの行（連続）', expect: '300 部品', delim: 'csv', text: ['部品名,型式,メーカ,数量', ...Array.from({ length: 300 }, (_, i) => (i % 3 ? `",",",${i}` : `部品${i},M-${i},オムロン,${i}`))].join('\n') + '\n' },
  { id: 'W20a-csv-ditto-maker-then-inch-model', note: 'CSV: メーカの「"」（〃の代わり。囲まない）の次の行の型式が囲まない 3/4"', expect: '3 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\n部品0,M-0,オムロン,0,\n部品1,M-1,",1,\n部品2,3/4",",2,\n' },
  { id: 'W20b-csv-ditto-note-then-inch-model', note: 'CSV: 備考の「"」（囲まない）が続き、型式が囲まない 3/4" の行がある 300 行', expect: '300 部品', delim: 'csv', text: ['部品名,型式,メーカ,数量,備考', ...Array.from({ length: 300 }, (_, i) => `部品${i},${i % 3 === 0 ? '3/4"' : 'M-' + i},${i % 2 ? '"' : 'オムロン'},${i},`)].join('\n') + '\n' },
  { id: 'W18-csv-title4-commas-ml', note: 'CSV（Excel 形式）: コンマ入りの表題 4 行（客先,X など）＋見出し＋引用符なしの部品 2 行＋コンマ入りメーカ 4 行（うち 2 行の備考が複数行でコンマ 3 つ）', expect: '6 部品', delim: 'csv', text: '客先,X商事\n図番,D-100\n作成,山田\n日付,2026-10-25\n部品名,型式,メーカ,数量,備考\n部品0,M-0,オムロン,0,\n部品1,M-1,オムロン,1,\nQ0,M-0,"Omron, Inc.",0,\nQ1,M-1,"Omron, Inc.",1,"a, b, c, d\ne"\nQ2,M-2,"Omron, Inc.",2,\nQ3,M-3,"Omron, Inc.",3,"a, b, c, d\ne"\n' },
  { id: 'W01-tsv-title10-comma', note: 'TSV: 表題 10 行（タブ無し）＋見出し＋8 行、メーカに「Omron, Inc.」', expect: '8 部品', delim: 'tsv', text: [...titles(10), HDR.join('\t'), ...parts(8, false).map((r) => r.join('\t'))].join('\n') },
  { id: 'W02-tsv-multiline-notes-comma', note: 'TSV（Excel のコピー）: 備考が 3 行の複数行セル 10 行、メーカに「Omron, Inc.」', expect: '10 部品', delim: 'tsv', text: [HDR.join('\t'), ...parts(10, true).map((r) => r.join('\t'))].join('\n') },
  { id: 'W02b-tsv-multiline2-comma', note: 'TSV: 備考が 2 行の複数行セル 10 行（タブの行がちょうど半分）', expect: '10 部品', delim: 'tsv', text: [HDR.join('\t'), ...parts(10, false).map((r, i) => r.slice(0, 4).concat(['"1行目\n2行目"']).join('\t'))].join('\n') },
  { id: 'W05-csv-raw-ditto-ml5', note: 'CSV: 同じ行に囲まない「"」（メーカ）と中のコンマ 4 つの複数行セル', expect: '3 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\nA,M-1,オムロン,1,\nB,M-2,",2,"a, b, c, d, e\nf"\nC,M-3,オムロン,3,\n' },
  { id: 'W06-csv-raw-inch-ml5', note: 'CSV: 同じ行に囲まない 3/4"（型式）と中のコンマ 4 つの複数行セル', expect: '3 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\nA,M-1,オムロン,1,\nパイプ,3/4",オムロン,2,"a, b, c, d, e\nf"\nC,M-3,オムロン,3,\n' },
  { id: 'W07-csv-raw-inch-in-name-ml', note: 'CSV: 部品名の途中に 1/2"（囲まない）と同じ行の複数行セル（コンマ 5）', expect: '2 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\nパイプ 1/2" 長尺,M-1,オムロン,1,"a, b, c, d, e, f\ng"\nC,M-3,オムロン,3,\n' },
  { id: 'W07b-csv-excel-inch-ml5', note: 'CSV（Excel 形式）: "3/4""" と中のコンマ 5 つの複数行セル', expect: '3 部品', delim: 'csv', text: '部品名,型式,メーカ,数量,備考\nA,M-1,オムロン,1,\nパイプ,"3/4""",オムロン,2,"a, b, c, d, e, f\ng"\nC,M-3,オムロン,3,\n' },
]
