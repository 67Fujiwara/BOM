// ラウンド19: 貼り付けの入力（ラウンド18 の直しの周り: 備考・新の列の削除の言葉 その 7、書き写し／変えた行だけの変更図、
// セル内改行（CSV の複数行の見出し）、DNP・実装の列 その 3、号機・台数 その 4、表題欄の製作台数 その 2、Comment／Description、まとめ）→ cases/p19.json
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
// 変えた行だけ新を書く変更図（型式だけ旧／新）。1 行目は変えた行、2 行目以降の新が空の行の備考に言葉を書く。最後の行は何も書かない（変えていない）
const noteSheet = (words) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
${words.map((w, i) => `部品${i + 1}｜P-${i + 1}0｜｜オムロン｜1｜${w}`).join('\n')}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const cases = [
  // --- 備考の言葉 その 7（新の列が空の行。削除の意味 → 取り込まない、残す意味 → 取り込む）
  ['B1 note-del-past-polite', noteSheet(['削除しました', '削除した', '削除してください', '削除済み', '削除する'])],
  ['B2 note-del-reason-first', noteSheet(['不要のため削除', 'Rev.2で削除', 'B版にて削除', '設計変更により削除', '※削除', '使用しない'])],
  ['B3 note-keep-phrases', noteSheet(['削除はしない', '削除は不要', '削除保留', '削除見送り', '削除NG（客先指定）', '撤去後再取付'])],
  ['B4 note-other-del-words', noteSheet(['欠番', '取止め', '中止', '撤去済', 'Del'])],
  // --- 新の列の値 その 7（削除の言葉・削除の語で始まる部品名）
  ['N1 new-model-del-phrases', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜削除しました｜オムロン｜1
ランプ｜L-1｜削除してください｜IDEC｜1
ソケット｜PYF14A｜Del.｜オムロン｜2
端子台｜XW2B-20G4｜｜オムロン｜4`)],
  ['N2 new-name-starts-with-del-word', T(`品名（旧）｜品名（新）｜型式｜メーカー｜数量
工具｜取外し工具｜TR-10｜ホーザン｜1
ブラケット｜撤去用ブラケット｜BK-2｜ミスミ｜2
カバー｜廃止穴用カバー｜CV-3｜ミスミ｜2
リレー｜｜MY4N-D2｜オムロン｜4`)],
  // --- 1 列に旧→新を書いた（変更図の様式を使わない新人）
  ['A3 arrow-in-cell', T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY2N→MY4N-D2｜オムロン｜4｜型式変更
タイマ｜H3CR-A8｜オムロン｜1→2｜数量変更
ランプ｜L-1｜IDEC｜1｜`)],
  // --- セル内改行 その 3（Excel・CSV）
  ['M1 csv-multiline-header', `品名,"型式\n(新)",メーカー,数量\nリレー,MY4N-D2,オムロン,4\nランプ,L-1,IDEC,1`],
  ['M2 csv-multiline-header-and-comma-cell', `品名,型式,メーカー,数量,"備考\n(取付位置)"\nリレー,MY4N-D2,オムロン,4,"盤内上段, 左側\n(要確認)"\nタイマ,H3CR-A8,オムロン,2,盤内下段`],
  ['M3 tsv-multiline-header', `品名\t"型式\n（新）"\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nランプ\tL-1\tIDEC\t1`],
  ['M4 tsv-two-multiline-cells-row', `品名\t型式\tメーカー\t数量\t備考\nリレー\t"MY4N-D2\nDC24V"\tオムロン\t4\t"旧品\nMY2N"\nタイマ\tH3CR-A8\tオムロン\t2\t`],
  ['M5 tsv-multiline-qty-yobi', `品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t"4\n(予備1)"\nタイマ\tH3CR-A8\tオムロン\t2`],
  ['M6 csv-multiline-first-col-comma', `品名,型式,メーカー,数量\n"リレー, 小型\n(2c)",MY4N-D2,オムロン,4\nタイマ,H3CR-A8,オムロン,2`],
  // --- DNP・実装 その 3
  ['D1 jissou-maru-batsu', T(`品名｜型式｜メーカー｜数量｜実装
リレー｜MY4N-D2｜オムロン｜4｜○
タイマ｜H3CR-A8｜オムロン｜1｜×
ランプ｜L-1｜IDEC｜1｜○`)],
  ['D2 jissou-other-values', T(`品名｜型式｜メーカー｜数量｜実装
リレー｜MY4N-D2｜オムロン｜4｜実装
タイマ｜H3CR-A8｜オムロン｜1｜未
ランプ｜L-1｜IDEC｜1｜不要
ソケット｜PYF14A｜オムロン｜2｜－`)],
  ['D3 note-dnp-variants', T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜オムロン｜1｜DNP（将来用）
ランプ｜L-1｜IDEC｜1｜実装無し
ソケット｜PYF14A｜オムロン｜2｜実装せず
ヒューズ｜F-5A｜富士電機｜3｜未実装品`)],
  ['D4 dnp-header-maru', T(`品名｜型式｜メーカー｜数量｜DNP
リレー｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜オムロン｜1｜○
ランプ｜L-1｜IDEC｜1｜`)],
  ['D5 populate-fitted', T(`Designator｜Description｜Manufacturer｜Manufacturer Part Number｜Quantity｜Fitted
R1｜Chip Resistor｜KOA｜RK73H1JTTD1002F｜2｜Fitted
C1｜Chip Capacitor｜Murata｜GRM188R71H104KA93D｜1｜Not Fitted
U1｜MCU｜ST｜STM32F103C8T6｜1｜Fitted`)],
  ['D6 maker-halfkana-DNP', T(`品名｜型式｜ﾒｰｶｰ｜数量
リレー｜MY4N-D2｜オムロン｜4
反射フィルム｜RF-200｜DNP｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['D7 maker-seizoumoto-DNP', T(`品名｜型式｜製造元｜数量
リレー｜MY4N-D2｜オムロン｜4
反射フィルム｜RF-200｜DNP｜2`)],
  // --- 号機・台数 その 4
  ['Q1 no1-no2', T(`品名｜型式｜メーカー｜No.1｜No.2
リレー｜MY4N-D2｜オムロン｜2｜2
タイマ｜H3CR-A8｜オムロン｜1｜1`)],
  ['Q2 goukiyou', T(`品名｜型式｜メーカー｜1号機用｜2号機用
リレー｜MY4N-D2｜オムロン｜2｜2
タイマ｜H3CR-A8｜オムロン｜1｜1`)],
  ['Q3 suryo-paren-gouki', T(`品名｜型式｜メーカー｜数量(1号機)｜数量(2号機)｜数量(予備)
リレー｜MY4N-D2｜オムロン｜2｜2｜1
タイマ｜H3CR-A8｜オムロン｜1｜1｜`)],
  ['Q4 gouki-3-blanks', T(`品名｜型式｜メーカー｜1号機｜2号機｜3号機
リレー｜MY4N-D2｜オムロン｜2｜｜2
タイマ｜H3CR-A8｜オムロン｜｜1｜
ランプ｜L-1｜IDEC｜1｜1｜1`)],
  ['Q5 daitousu-daisu', T(`品名｜型式｜メーカー｜1台当数量｜台数
リレー｜MY4N-D2｜オムロン｜2｜3
タイマ｜H3CR-A8｜オムロン｜1｜3`)],
  ['Q6 insu-per-dai-seisakudaisu', T(`品名｜型式｜メーカー｜員数/台｜製作台数
リレー｜MY4N-D2｜オムロン｜2｜3
タイマ｜H3CR-A8｜オムロン｜1｜3`)],
  ['Q7 suryo-daisu-goukei', T(`品名｜型式｜メーカー｜数量｜台数｜合計
リレー｜MY4N-D2｜オムロン｜2｜3｜6
タイマ｜H3CR-A8｜オムロン｜1｜3｜3`)],
  ['Q8 two-tier-goukibetsu', T(`品名｜型式｜メーカー｜号機別数量｜｜
｜｜｜1｜2｜3
リレー｜MY4N-D2｜オムロン｜2｜2｜2
タイマ｜H3CR-A8｜オムロン｜1｜1｜1`)],
  // --- 表題欄の製作台数 その 2（見出しより上）
  ['T1 title-colon-one-cell', T(`盤名：制御盤A｜製作台数：3台｜｜
｜｜｜
品名｜型式｜メーカー｜1台当り数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T2 title-separate-cells-unit', T(`盤名｜制御盤A｜製作台数｜3｜台
品名｜型式｜メーカー｜1台当り数量｜
リレー｜MY4N-D2｜オムロン｜2｜
タイマ｜H3CR-A8｜オムロン｜1｜`)],
  ['T3 title-seisaku-suryo', T(`盤名｜制御盤A｜製作数量｜3台
品名｜型式｜メーカー｜1台当り数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T4 title-daisu-with-note', T(`盤名｜制御盤A｜製作台数｜3台（予備機含まず）
品名｜型式｜メーカー｜1台当り数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T5 title-vertical', T(`盤名｜製作台数｜｜
制御盤A｜3｜｜
品名｜型式｜メーカー｜1台当り数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T6 title-insu', T(`盤名｜制御盤A｜製作台数｜3台
品名｜型式｜メーカー｜員数
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T7 title-daitousu', T(`盤名｜制御盤A｜製作台数｜3台
品名｜型式｜メーカー｜1台当数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T8 title-1daibun-fullwidth', T(`盤名｜制御盤A｜製作台数｜３台
品名｜型式｜メーカー｜数量（1台分）
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T9 title-plain-suryo', T(`盤名｜制御盤A｜製作台数｜3台
品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['T10 daisu-right-of-header', T(`品名｜型式｜メーカー｜1台当り数量｜｜製作台数｜3
リレー｜MY4N-D2｜オムロン｜2｜｜｜
タイマ｜H3CR-A8｜オムロン｜1｜｜｜`)],
  // --- Comment／Description その 2
  ['C1 altium-with-notes-col', T(`Comment｜Description｜Designator｜Quantity｜Manufacturer｜Manufacturer Part Number｜Notes
10k｜Chip Resistor｜R1, R2｜2｜KOA｜RK73H1JTTD1002F｜
100n｜Chip Capacitor｜C1｜1｜Murata｜GRM188R71H104KA93D｜X7R`)],
  ['C2 altium-description-blank', T(`Comment｜Description｜Designator｜Quantity｜Manufacturer｜Manufacturer Part Number
10k｜Chip Resistor｜R1, R2｜2｜KOA｜RK73H1JTTD1002F
LED_Red｜｜D1｜1｜Rohm｜SML-310LTT86`)],
  ['C3 jp-comment-col', T(`品名｜型式｜メーカー｜数量｜コメント
リレー｜MY4N-D2｜オムロン｜4｜盤内上段
タイマ｜H3CR-A8｜オムロン｜1｜`)],
  ['C4 jp-hinmei-comment-bikou', T(`品名｜型式｜メーカー｜数量｜Comment｜備考
リレー｜MY4N-D2｜オムロン｜4｜客先支給の可能性あり｜盤内上段
タイマ｜H3CR-A8｜オムロン｜1｜｜`)],
  ['C5 kicad-value-description', T(`Reference｜Value｜Footprint｜Qty｜Description｜MPN｜Manufacturer
R1,R2｜10k｜R_0603｜2｜Thick film resistor｜RK73H1JTTD1002F｜KOA
C1｜100n｜C_0603｜1｜MLCC｜GRM188R71H104KA93D｜Murata`)],
  // --- まとめ（新人の手元の 1 枚: 表題欄・〃・DNP・小計・ページの見出し・署名）
  ['X1 combined-messy', T(`部品表｜｜｜｜
盤名：制御盤A｜製作台数：2台｜｜｜
品名｜型式｜メーカー｜1台当り数量｜備考
リレー｜MY4N-D2｜オムロン｜2｜
リレー｜MY2N｜〃｜1｜
タイマ｜H3CR-A8｜オムロン｜1｜DNP
小計｜｜｜4｜
部品表 (2/2)｜｜｜｜
品名｜型式｜メーカー｜1台当り数量｜備考
ランプ｜L-1｜IDEC｜1｜
作成｜山田｜承認｜鈴木｜`)],
]
fs.writeFileSync(new URL('./cases/p19.json', import.meta.url), JSON.stringify(cases, null, 1))
console.log(cases.length)
