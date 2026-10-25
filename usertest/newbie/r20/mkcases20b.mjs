// ラウンド20 その 2: DNP・複数行セル・変更図の組み合わせ・まとめ → cases/p20b.json  [title, text, expect?]
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = []
const add = (t, text, exp) => cases.push(exp ? [t, text, exp] : [t, text])
const hdr = '品名｜型式｜メーカー｜数量'
// ---- DNP・実装
add('P1 part name starts with DNP + space (大日本印刷 film)', T(`${hdr}\nDNP 反射フィルム｜RF-200｜ミスミ｜2\nリレー｜MY4N-D2｜オムロン｜4`), ['RF-200:2', 'MY4N-D2:4'])
add('P2 model DNP-1234', T(`${hdr}\n反射フィルム｜DNP-1234｜大日本印刷｜2\nリレー｜MY4N-D2｜オムロン｜4`), ['DNP-1234:2', 'MY4N-D2:4'])
add('P3 maker 大日本印刷(DNP)', T(`${hdr}\n反射フィルム｜RF-200｜大日本印刷(DNP)｜2\nリレー｜MY4N-D2｜オムロン｜4`), ['RF-200:2', 'MY4N-D2:4'])
add('P4 note DNP (将来用) drops', T(`品名｜型式｜メーカー｜数量｜備考\n反射フィルム｜RF-200｜X｜2｜DNP（将来用）\nリレー｜MY4N-D2｜オムロン｜4｜`), ['MY4N-D2:4'])
add('P5 note 「DNP品あり」 not exact', T(`品名｜型式｜メーカー｜数量｜備考\n反射フィルム｜RF-200｜X｜2｜DNP品あり\nリレー｜MY4N-D2｜オムロン｜4｜`), ['RF-200:2', 'MY4N-D2:4'])
add('P6 実装 column ○/×', T(`品名｜型式｜メーカー｜数量｜実装\nリレー｜MY4N-D2｜オムロン｜4｜○\nタイマ｜H3CR-A8｜オムロン｜1｜×\nランプ｜L-1｜IDEC｜2｜`), ['MY4N-D2:4', 'L-1:2'])
add('P7 実装 column あり/なし', T(`品名｜型式｜メーカー｜数量｜実装\nリレー｜MY4N-D2｜オムロン｜4｜あり\nタイマ｜H3CR-A8｜オムロン｜1｜なし\nランプ｜L-1｜IDEC｜2｜あり`), ['MY4N-D2:4', 'L-1:2'])
add('P8 実装 column 実装/未実装', T(`品名｜型式｜メーカー｜数量｜実装\nリレー｜MY4N-D2｜オムロン｜4｜実装\nタイマ｜H3CR-A8｜オムロン｜1｜未実装\nランプ｜L-1｜IDEC｜2｜実装`), ['MY4N-D2:4', 'L-1:2'])
add('P9 実装 column 取付位置 values (盤内/現場) - 実装 as mounting place', T(`品名｜型式｜メーカー｜数量｜実装\nリレー｜MY4N-D2｜オムロン｜4｜盤内\nタイマ｜H3CR-A8｜オムロン｜1｜現場`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('P10 Altium Fitted column Not Fitted', T(`Comment｜Description｜Designator｜Quantity｜Fitted\n10k｜Resistor｜R1｜1｜Fitted\n0R｜Resistor｜R2｜1｜Not Fitted`))
add('P11 DNP col header with ○', T(`品名｜型式｜メーカー｜数量｜DNP\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜○`), ['MY4N-D2:4'])
add('P12 DNP header values DNP/blank', T(`品名｜型式｜メーカー｜数量｜DNP\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜DNP`), ['MY4N-D2:4'])
add('P13 備考 実装無し / 実装せず / 非実装', T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜実装無し\nランプ｜L-1｜IDEC｜2｜実装せず\nソケット｜PYF14A｜オムロン｜2｜非実装`), ['MY4N-D2:4'])
add('P14 備考 実装しない場合あり (sentence)', T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜実装しない場合は要連絡`), ['MY4N-D2:4'])
add('P15 備考 DNPは別途', T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜DNPは別途手配`), ['MY4N-D2:4'])
add('P16 名称 未実装基板 (V19-05)', T(`${hdr}\n未実装基板｜PCB-1｜自社｜1\nリレー｜MY4N-D2｜オムロン｜4`), ['PCB-1:1', 'MY4N-D2:4'])
// ---- 複数行セル（CSV・TSV）
add('Q1 CSV multi-line note last col', `品名,型式,メーカー,数量,備考\nリレー,MY4N-D2,オムロン,4,"盤内上段\n左側"\nタイマ,H3CR-A8,オムロン,1,`, ['MY4N-D2:4', 'H3CR-A8:1'])
add('Q2 CSV title row + multi-line note', `制御盤A 部品表,,,,\n,,,,\n品名,型式,メーカー,数量,備考\nリレー,MY4N-D2,オムロン,4,"盤内上段\n左側"\nタイマ,H3CR-A8,オムロン,1,`, ['MY4N-D2:4', 'H3CR-A8:1'])
add('Q3 CSV inch marks and ditto "', `品名,型式,メーカー,数量\nファン 4",FAN-4,山洋,2\n〃,FAN-5",山洋,1\nリレー,MY4N-D2,オムロン,4`)
add('Q4 TSV every row has a multi-line cell', `品名\t型式\tメーカー\t数量\t備考\nリレー\tMY4N-D2\tオムロン\t4\t"a\nb"\nタイマ\tH3CR-A8\tオムロン\t1\t"c\nd"\nランプ\tL-1\tIDEC\t2\t"e\nf"`, ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
add('Q5 CSV multi-line header cells all', `"品名\n(部品)","型式\n(新)","メーカー\n(名称)","数量\n(個)"\nリレー,MY4N-D2,オムロン,4\nタイマ,H3CR-A8,オムロン,1`, ['MY4N-D2:4', 'H3CR-A8:1'])
add('Q6 CSV multi-line cell with quotes inside', `品名,型式,メーカー,数量,備考\nリレー,MY4N-D2,オムロン,4,"客先指示 ""要確認""\n(2号機のみ)"\nタイマ,H3CR-A8,オムロン,1,`, ['MY4N-D2:4', 'H3CR-A8:1'])
add('Q7 CSV only 2 rows, multi-line cell (width ambiguity)', `品名,型式,数量\n"リレー\n小型",MY4N-D2,4`, ['MY4N-D2:4'])
add('Q8 TSV multi-line cell with tab? (should not)', `品名\t型式\t数量\nリレー\t"MY4N-D2\n(DC24V)"\t4\nタイマ\tH3CR-A8\t2`, ['MY4N-D2 (DC24V):4', 'H3CR-A8:2'])
add('Q9 CSV: multi-line cell containing commas and 4 columns total', `品名,型式,数量\n"リレー, 小型,\n24V",MY4N-D2,4\nタイマ,H3CR-A8,2`, ['MY4N-D2:4', 'H3CR-A8:2'])
add('Q10 CSV: cell with ditto " mid-table and a multiline cell later', `品名,型式,数量,備考\nリレー,MY4N-D2,4,\n",MY4N-D2X,2,\nタイマ,H3CR-A8,1,"a\nb"`)
// ---- 変更図の組み合わせ
add('R1 変更区分 + 旧/新 + 備考 削除 words', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量｜備考
変更｜リレー｜MY2N｜MY4N-D2｜4｜
削除｜タイマ｜H3CR-A8｜｜1｜
〃｜ランプ｜L-1｜｜1｜
追加｜ソケット｜｜PYF14A｜2｜
｜端子台｜XW2B-20G4｜｜4｜削除済`), ['MY4N-D2:4', 'PYF14A:2'])
add('R2 sparse change sheet: only changed rows + totals + signature', T(`設計変更通知書｜｜｜｜
変更番号｜ECN-123｜｜｜
品名｜型式（変更前）｜型式（変更後）｜数量（変更前）｜数量（変更後）
リレー｜MY2N｜MY4N-D2｜4｜4
タイマ｜H3CR-A8｜｜1｜0
合計｜｜｜5｜4
作成｜山田｜承認｜鈴木｜`), ['MY4N-D2:4'])
add('R3 qty 0 means deletion', T(`品名｜型式（旧）｜型式（新）｜数量（旧）｜数量（新）
リレー｜MY2N｜MY4N-D2｜4｜4
タイマ｜H3CR-A8｜H3CR-A8｜1｜0
ランプ｜L-1｜｜2｜`), ['MY4N-D2:4', 'L-1:2'])
add('R4 per-machine change: 旧1号機/旧2号機/新1号機/新2号機', T(`品名｜型式｜1号機（旧）｜2号機（旧）｜1号機（新）｜2号機（新）
リレー｜MY4N-D2｜2｜2｜3｜3
タイマ｜H3CR-A8｜1｜1｜｜
ランプ｜L-1｜1｜1｜0｜0`), ['MY4N-D2:6', 'H3CR-A8:2'])
add('R5 旧→新 in cells with 変更区分 column', T(`変更区分｜品名｜型式｜数量
変更｜リレー｜MY2N→MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜1
追加｜ランプ｜L-1｜2`), ['MY4N-D2:4', 'L-1:2'])
add('R6 変更前/変更後 two-tier with 変更区分 first col', T(`区分｜品名｜変更前｜｜変更後｜
｜｜型式｜数量｜型式｜数量
変更｜リレー｜MY2N｜4｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜1｜｜
追加｜ランプ｜｜｜L-1｜2`), ['MY4N-D2:4', 'L-1:2'])
add('R7 old/new where 新 has 同左 / 変更なし text', T(`品名｜型式（旧）｜型式（新）｜数量
リレー｜MY2N｜MY4N-D2｜4
タイマ｜H3CR-A8｜変更なし｜1
ランプ｜L-1｜同左｜2
ソケット｜PYF14A｜削除｜2`), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
add('R8 新 column with 〃 below a change', T(`品名｜型式（旧）｜型式（新）｜数量
リレー1｜MY2N｜MY4N-D2｜4
リレー2｜MY2N｜〃｜4
タイマ｜H3CR-A8｜｜1`), ['MY4N-D2:4', 'MY4N-D2:4', 'H3CR-A8:1'])
add('R9 ECN 一覧: 旧品番/新品番/員数 + 理由 col with 廃止', T(`No｜旧品番｜新品番｜員数｜理由
1｜MY2N｜MY4N-D2｜4｜MY2N廃止
2｜H3CR-A8｜｜1｜
3｜L-1｜｜2｜`), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
add('R10 変更内容 列に「削除」だけ (変更内容 acts as note)', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容
リレー｜MY2N｜MY4N-D2｜4｜型式変更
タイマ｜H3CR-A8｜｜1｜削除`), ['MY4N-D2:4'])
add('R11 変更内容 + 備考 where 削除 in 変更内容 only', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜盤内
タイマ｜H3CR-A8｜｜1｜削除｜盤内`), ['MY4N-D2:4'])
add('R12 備考 + 変更内容 where 削除 in 備考 (備考 first)', T(`品名｜型式（旧）｜型式（新）｜数量｜備考｜変更内容
リレー｜MY2N｜MY4N-D2｜4｜盤内｜型式変更
タイマ｜H3CR-A8｜｜1｜削除｜`), ['MY4N-D2:4'])
add('R13 ordinary BOM with 変更内容 and 備考 both (note kept?)', T(`品名｜型式｜メーカー｜数量｜変更内容｜備考
リレー｜MY4N-D2｜オムロン｜4｜型式変更｜盤内上段`))
add('R14 ordinary BOM with 変更点 and 備考', T(`品名｜型式｜メーカー｜数量｜変更点｜備考\nリレー｜MY4N-D2｜オムロン｜4｜数量増｜客先指定`))
// ---- まとめ
add('S1 ECN with page header, title, change sheets, totals and signature (all in one)', T(`部品表（変更）｜｜｜｜
制御盤A｜製作台数：3台｜｜｜P.1
品名｜型式（旧）｜型式（新）｜員数｜備考
リレー｜MY2N｜MY4N-D2｜2｜
タイマ｜H3CR-A8｜｜1｜削除
〃｜H3CR-A8N｜｜1｜〃
ランプ｜L-1｜｜2｜
合計｜｜｜5｜
作成｜山田｜承認｜鈴木｜`))
add('S2 half-width kana title + 号機 two-tier', T(`ﾌﾞﾋﾝﾋｮｳ｜｜｜｜
ﾋﾝﾒｲ｜ｶﾀｼｷ｜ｽｳﾘｮｳ｜｜
｜｜1｜2｜3
ﾘﾚｰ｜MY4N-D2｜2｜2｜2`))
add('S3 header 型式 duplicated across pages with 変更区分', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
変更区分｜品名｜型式（旧）｜型式（新）｜数量
削除｜タイマ｜H3CR-A8｜｜1
追加｜ランプ｜｜L-1｜2`), ['MY4N-D2:4', 'L-1:2'])
fs.writeFileSync('/home/user/BOM/usertest/newbie/r20/cases/p20b.json', JSON.stringify(cases, null, 1))
console.log(cases.length)
