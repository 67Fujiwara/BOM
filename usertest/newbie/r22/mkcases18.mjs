// ラウンド18: 貼り付けの入力（ラウンド17 の直しの周り: 書き写す表の判定・備考の削除・号機／台数の数量・DNP・署名欄・セル内改行・EDA）→ cases/p18.json
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = [
  // --- 変えた行だけ書く変更図で、数量だけ変えた行に新の型式（同じ値）も書いた（書き写す表と間違えられないか）
  ['A1 changed-only-qty-rows-copy-model', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜型式変更
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2｜数量変更 1→2
ソケット｜PYF14A｜PYF14A｜オムロン｜4｜数量変更 2→4
端子台｜XW2B-20G4｜｜オムロン｜4｜
ランプ｜L-1｜｜IDEC｜1｜`)],
  ['A2 changed-only-maker-rows-copy-model', T(`品名｜型式（旧）｜型式（新）｜メーカー（旧）｜メーカー（新）｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜｜4
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜パナソニック｜2
ソケット｜PYF14A｜PYF14A｜オムロン｜IDEC｜4
端子台｜XW2B-20G4｜｜オムロン｜｜4
ランプ｜L-1｜｜IDEC｜｜1
ヒューズ｜F-5A｜｜富士電機｜｜3`)],
  // --- 備考の言葉（変えた行だけ書く表。新の列が空の行は変えていない）
  ['B1 note-not-delete-words', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜｜オムロン｜1｜削除不要
ランプ｜L-1｜｜IDEC｜1｜撤去不要（流用）
ソケット｜PYF14A｜｜オムロン｜2｜削除取消（Rev.2で復活）
ブレーカ｜NF32-SV｜｜三菱電機｜1｜廃止取りやめ
端子台｜XW2B-20G4｜｜オムロン｜4｜削除無
スイッチ｜A22-FR｜｜オムロン｜2｜廃止品から変更済`)],
  ['B2 note-delete-other-words', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜｜オムロン｜1｜不要
ランプ｜L-1｜｜IDEC｜1｜要削除
ソケット｜PYF14A｜｜オムロン｜2｜削除します
ブレーカ｜NF32-SV｜｜三菱電機｜1｜Rev.1 削除
端子台｜XW2B-20G4｜｜オムロン｜4｜`)],
  // --- 新の列の削除の書き方 その 6
  ['C1 new-col-delete-variants6', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量（旧）｜数量（新）
リレー｜MY2N｜MY4N-D2｜オムロン｜2｜4
タイマ｜H3CR-A8｜削除済｜オムロン｜1｜
ランプ｜L-1｜削除（R012に置換）｜IDEC｜1｜
ソケット｜PYF14A｜なし｜オムロン｜2｜0
ブレーカ｜NF32-SV｜撤去済｜三菱電機｜1｜
スイッチ｜A22-FR｜－｜オムロン｜2｜0
端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4｜4`)],
  // --- 全行を書き写した表で、削除を「－」・「×」で書く
  ['C2 full-copy-delete-dash-2rows', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量（旧）｜数量（新）
リレー｜MY2N｜MY4N-D2｜オムロン｜2｜2
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜1｜1
ブレーカ｜NF32-SV｜－｜三菱電機｜1｜－
端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4｜4
ランプ｜L-1｜－｜IDEC｜1｜－`)],
  // --- 号機・台数の数量 その 3
  ['Q1 suryo-daisu', T(`品名｜型式｜メーカー｜数量｜台数
リレー｜MY4N-D2｜オムロン｜2｜3
タイマ｜H3CR-A8｜オムロン｜1｜3`)],
  ['Q2 insu-daisu-noTotal', T(`品名｜型式｜メーカー｜員数｜台数
リレー｜MY4N-D2｜オムロン｜2｜3
タイマ｜H3CR-A8｜オムロン｜1｜3`)],
  ['Q3 daime-1tier', T(`品名｜型式｜メーカー｜1台目｜2台目
リレー｜MY4N-D2｜オムロン｜2｜2
タイマ｜H3CR-A8｜オムロン｜1｜1`)],
  ['Q4 gouki-total-blank', T(`品名｜型式｜メーカー｜1号機｜2号機｜合計
リレー｜MY4N-D2｜オムロン｜2｜2｜4
タイマ｜H3CR-A8｜オムロン｜1｜1｜`)],
  ['Q5 gouki-ditto-first-col', T(`品名｜型式｜メーカー｜1号機数量｜2号機数量
リレー｜MY4N-D2｜オムロン｜2｜2
リレー｜MY2N｜オムロン｜〃｜1
タイマ｜H3CR-A8｜オムロン｜1｜〃`)],
  ['Q6 gouki-units-in-cells', T(`品名｜型式｜メーカー｜1号機｜2号機
リレー｜MY4N-D2｜オムロン｜2個｜2個
タイマ｜H3CR-A8｜オムロン｜1個｜－`)],
  ['Q7 single-qty-plus-and-yobi', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜４＋１
タイマ｜H3CR-A8｜オムロン｜2（予備含む）
ソケット｜PYF14A｜オムロン｜2(予備1)`)],
  ['Q8 hitsuyou-hacchu-moq', T(`品名｜型式｜メーカー｜必要数｜発注数
リレー｜MY4N-D2｜オムロン｜6｜10
タイマ｜H3CR-A8｜オムロン｜3｜5`)],
  // --- DNP・実装
  ['D1 maker-DNP-daini-insatsu', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
反射フィルム｜RF-200｜DNP｜2
タイマ｜H3CR-A8｜オムロン｜1`)],
  ['D2 jissou-umu', T(`品名｜型式｜メーカー｜数量｜実装
リレー｜MY4N-D2｜オムロン｜4｜有
タイマ｜H3CR-A8｜オムロン｜1｜無
ランプ｜L-1｜IDEC｜1｜しない`)],
  ['D3 note-mijissou-variants', T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜オムロン｜1｜未実装（将来用）
ランプ｜L-1｜IDEC｜1｜実装しない
ソケット｜PYF14A｜オムロン｜2｜DNP`)],
  // --- 署名欄・改訂欄
  ['S1 sign-colon-cells', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
作成：山田｜承認：鈴木｜検図：佐藤｜`)],
  ['S2 sign-label-row-and-name-row', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
｜｜｜
承認｜検図｜作成｜
鈴木｜佐藤｜山田｜`)],
  ['S3 sign-with-date', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
設計｜山田｜2026/10/20｜`)],
  ['S4 revision-block-below', T(`品名｜型式｜メーカー｜数量
リレー｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜オムロン｜2
｜｜｜
改訂｜日付｜内容｜担当
1｜2026/10/01｜初版｜山田
2｜2026/10/20｜タイマ追加｜山田`)],
  // --- Excel のセル内改行（Alt+Enter）。Excel は改行のあるセルを "…" で囲んで貼る
  ['M1 cell-trailing-newline', `品名\t型式\tメーカー\t数量\n"リレー\n"\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2`],
  ['M2 cell-leading-newline', `品名\t型式\tメーカー\t数量\nリレー\t"\nMY4N-D2"\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2`],
  ['M3 cell-blank-line-inside', `品名\t型式\tメーカー\t数量\t備考\nリレー\tMY4N-D2\tオムロン\t4\t"旧 MY2N\n\n変更 Rev.1"\nタイマ\tH3CR-A8\tオムロン\t2\t`],
  ['M4 note-two-line-with-inch', `品名\t型式\tメーカー\t数量\t備考\nホース\tH-1/2\tニッタ\t2\t"1/2"" 用\n長さ 2m"\nタイマ\tH3CR-A8\tオムロン\t2\t`],
  // --- EDA
  ['E1 altium-comment-description', T(`Comment｜Description｜Designator｜Footprint｜LibRef｜Quantity｜Manufacturer｜Manufacturer Part Number
10k｜Chip Resistor｜R1, R2｜0603｜RES｜2｜KOA｜RK73H1JTTD1002F
100n｜Chip Capacitor｜C1｜0603｜CAP｜1｜Murata｜GRM188R71H104KA93D`)],
  ['E2 kicad-default-grouped', `"Item","Qty","Reference(s)","Value","LibPart","Footprint","Datasheet","MPN","Manufacturer"\n"1","2","R1, R2","10k","Device:R","Resistor_SMD:R_0603","~","RK73H1JTTD1002F","KOA"\n"2","1","C1","100n","Device:C","Capacitor_SMD:C_0603","~","GRM188R71H104KA93D","Murata"`],
]
fs.writeFileSync(new URL('./cases/p18.json', import.meta.url), JSON.stringify(cases, null, 1))
console.log(cases.length)
