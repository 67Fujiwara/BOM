// ラウンド20: 取り込みの入力（ラウンド19 の直しの周り）→ cases/p20.json  [title, text, expect?]
// expect は "ラベル:数量"（ラベル = 型式 || 部品名、備考が【削除？】で始まれば末尾に ?）の配列。分からないもの（判断が分かれる書き方）は expect を付けず INFO
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = []
const add = (t, text, exp) => cases.push(exp ? [t, text, exp] : [t, text])

// ---------- A 備考の削除の言葉（変えた行だけ新を書く変更図。部品n は新が空）
const noteSheet = (words) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
${words.map((w, i) => `部品${i + 1}｜P-${i + 1}0｜｜オムロン｜1｜${w}`).join('\n')}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const KEEP_ALL = (n) => ['MY4N-D2:4', ...Array.from({ length: n }, (_, i) => `P-${i + 1}0:1`), 'XW2B-20G4:4']
const DEL_ALL = ['MY4N-D2:4', 'XW2B-20G4:4']
// 削除と読むべき言葉（1 語ずつ）
const delWords = ['削除', '削除済', '削除済み', '削除します', '削除のこと', '削除せよ', '削除（R012に置換）', '【削除】', '※削除', '要削除', 'Rev.2 削除', 'Rev.2で削除', '不要のため削除', '客先指示により削除', '削除→不要', '廃止', '撤去', '欠番', '取止め', '中止', '不要', 'Del', '削除して下さい', '削除願います', '削除をお願いします', '削除とします', 'ユニットごと削除', '旧品削除', '今回削除', '本変更で削除']
for (const w of delWords) add(`A-del 「${w}」`, noteSheet([w]), DEL_ALL)
// 新人が書きそうな、削除の別の言い方（削除と読むのが自然）
const delWords2 = ['削除です', '削除お願いします', '削除でお願いします', '削除ください', '削除完了', '削除ずみ', '削除となります', '削除されました', '削除になりました', '削除に変更', '削除 済', '削除（済）', '削除して', '削除OK', '削除で', 'Rev.B:削除', 'Rev.2: 削除', '(Rev.2)削除', 'R2削除', '撤去します', '撤去しました', '撤去のこと', '撤去済み', '取外し済', '取外します', '廃止品', '廃止とする', '廃止しました']
for (const w of delWords2) add(`A-del2 「${w}」`, noteSheet([w]), DEL_ALL)
// 残すべき言葉
const keepWords = ['削除しない', '削除不要', '削除はしない', '削除は不要', '削除予定', '削除は次回', '削除保留', '削除検討', '削除の可能性あり', '削除可否確認', '削除しないこと', '削除禁止', '削除NG', '削除不可', '削除できない', '削除しないでください', '削除してはいけない', '削除要否確認', '削除の場合は連絡', '削除すると不具合', '削除ではなく変更', '削除せず', '削除しません', '削除取消', '削除を取り消し', '削除は取りやめ', '削除未定', '削除は見送り', '撤去後再取付', '撤去は後日', '取外し時注意', '廃止予定', '廃止検討中', '廃止品から変更', '廃止になったら連絡', '削除しても可', '削除しなくてよい', '削除ではない', '削除不要です', '削除（しない）', '削除（保留）', '削除（不要）', '削除（要確認）', '削除（検討中）', '撤去（再取付）', '取外し（再利用）', '削除→保留', '削除→再追加', '撤去不要', '廃止しない', '欠番ではない', '中止しない', '不要かも', '不要？', '削除？', '削除かも', '削除してもよい', '削除でもよい']
for (const w of keepWords) add(`A-keep 「${w}」`, noteSheet([w]), KEEP_ALL(1))
// 通常の備考（変更図でも普通に書く）は残る
add('A-keep-ordinary notes', noteSheet(['盤内上段', '客先支給', '要確認', 'UL認証品', '取付位置変更なし', '代替可', '納期注意', '旧品あり', '削除の手間なし', 'Rev.2対応', '撤去工事は別途']), KEEP_ALL(11))

// ---------- B 変更区分の列
const kindSheet = (hdr, vals) => T(`${hdr}｜品名｜型式（旧）｜型式（新）｜数量
${vals.map((v, i) => `${v}｜部品${i}｜P-${i}0｜${/^(追加|新規)/.test(v) ? 'N-' + i : ''}｜${i + 1}`).join('\n')}`)
for (const hdr of ['区分', '変更区分', '変更種別', '変更の種類', '処置', '処置区分', 'ECN区分', '変更有無', '内容']) {
  add(`B-kind hdr「${hdr}」 追加/変更/削除`, T(`${hdr}｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜｜1
追加｜ランプ｜｜L-1｜2
｜端子台｜XW2B-20G4｜｜4`), hdr === '変更有無' || hdr === '内容' ? undefined : ['MY4N-D2:4', 'L-1:2', 'XW2B-20G4:4'])
}
for (const v of ['削除済', '削除済み', '削除品', '廃止', '取消', '×', '(削除)', '削除 (旧品)', 'DEL', 'Del', 'D', '撤去済', '不要', '除却', '削除する', '削除します', 'Delete', 'Deleted', 'Removed', '削', '削除↓', '削除〃', '〃削除']) {
  add(`B-kind 変更区分 値「${v}」`, T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
${v}｜タイマ｜H3CR-A8｜｜1
変更なし｜端子台｜XW2B-20G4｜｜4`), ['MY4N-D2:4', 'XW2B-20G4:4'])
}
add('B-kind ditto under 削除', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜｜1
〃｜ランプ｜L-1｜｜1
追加｜ソケット｜｜PYF14A｜2`), ['MY4N-D2:4', 'PYF14A:2'])
add('B-kind plain table (no old/new) with 変更区分 last', T(`品名｜型式｜メーカー｜数量｜変更区分
リレー｜MY4N-D2｜オムロン｜4｜変更
タイマ｜H3CR-A8｜オムロン｜1｜削除
ランプ｜L-1｜IDEC｜2｜追加
端子台｜XW2B-20G4｜オムロン｜4｜`), ['MY4N-D2:4', 'L-1:2', 'XW2B-20G4:4'])
add('B-kind 区分 = 新規/流用 (ordinary BOM classification)', T(`区分｜品名｜型式｜メーカー｜数量
新規｜リレー｜MY4N-D2｜オムロン｜4
流用｜タイマ｜H3CR-A8｜オムロン｜1
新規｜ランプ｜L-1｜IDEC｜2`), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
add('B-kind 区分 = 制御/電源 (ordinary BOM category)', T(`区分｜品名｜型式｜メーカー｜数量
制御｜リレー｜MY4N-D2｜オムロン｜4
電源｜電源｜S8VK｜オムロン｜1
制御｜ランプ｜L-1｜IDEC｜2`), ['MY4N-D2:4', 'S8VK:1', 'L-1:2'])
add('B-kind 区分 = 追加のみ ordinary', T(`区分｜品名｜型式｜メーカー｜数量
追加｜リレー｜MY4N-D2｜オムロン｜4
追加｜タイマ｜H3CR-A8｜オムロン｜1`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('B-kind 種別 = 部品種別 ordinary (変更 included)', T(`種別｜品名｜型式｜数量
変更｜リレー｜MY4N-D2｜4
標準｜タイマ｜H3CR-A8｜1`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('B-kind 変更 column with ○ marks (ordinary)', T(`品名｜型式｜数量｜変更
リレー｜MY4N-D2｜4｜○
タイマ｜H3CR-A8｜1｜
ランプ｜L-1｜2｜○`), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
add('B-kind 変更 column with 削除 (no kind hdr words)', T(`品名｜型式｜数量｜変更
リレー｜MY4N-D2｜4｜変更
タイマ｜H3CR-A8｜1｜削除
ランプ｜L-1｜2｜追加`), ['MY4N-D2:4', 'L-1:2'])
add('B-kind half-width / full-width spaces 削除', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
 削除 ｜タイマ｜H3CR-A8｜｜1
　削除　｜ランプ｜L-1｜｜1
さくじょ｜ソケット｜PYF14A｜｜2`), ['MY4N-D2:4', 'PYF14A:2'])

// ---------- C 【削除？】の出方（ふつうの表で騒がない・出たときの数）
const cs = (rows, hdr = '品名｜型式（旧）｜型式（新）｜メーカー｜数量') => T(`${hdr}\n${rows.join('\n')}`)
add('C1 changed-only sheet: 5 changed + 3 untouched (no marks)', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A｜H3CR-A8｜オムロン｜1', 'ランプ｜L-0｜L-1｜IDEC｜2', 'ソケット｜PYF08A｜PYF14A｜オムロン｜2', 'ヒューズ｜F-1｜F-2｜SOC｜2', '端子台｜XW2B-20G4｜｜オムロン｜4', 'ブレーカ｜NF30｜｜三菱｜1', '電源｜S8VK｜｜オムロン｜1']), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2', 'PYF14A:2', 'F-2:2', 'XW2B-20G4:4', 'NF30:1', 'S8VK:1'])
add('C2 3 copies(qty-only rows wrote model) + 3 untouched => marks', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2', 'ランプ｜L-1｜L-1｜IDEC｜3', 'ソケット｜PYF14A｜PYF14A｜オムロン｜2', '端子台｜XW2B-20G4｜｜オムロン｜4', 'ブレーカ｜NF30｜｜三菱｜1', '電源｜S8VK｜｜オムロン｜1']))
add('C3 3 copies + 10 untouched (ratio)', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2', 'ランプ｜L-1｜L-1｜IDEC｜3', 'ソケット｜PYF14A｜PYF14A｜オムロン｜2', ...Array.from({ length: 10 }, (_, i) => `部品${i}｜P-${i}｜｜X｜1`)]))
add('C4 3 copies + 9 untouched (boundary)', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2', 'ランプ｜L-1｜L-1｜IDEC｜3', 'ソケット｜PYF14A｜PYF14A｜オムロン｜2', ...Array.from({ length: 9 }, (_, i) => `部品${i}｜P-${i}｜｜X｜1`)]))
add('C5 full-copy sheet: 2 changed, 3 copied, 1 deleted(empty)', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2', 'ランプ｜L-1｜L-1｜IDEC｜3', 'ソケット｜PYF14A｜PYF14A｜オムロン｜2', '端子台｜XW2B-20G4｜｜オムロン｜4']), ['MY4N-D2:4', 'H3CR-A8:2', 'L-1:3', 'PYF14A:2'])
add('C6 model+qty versions, maker differs only (N19-04 shape)', T(`品名｜型式（旧）｜型式（新）｜数量（旧）｜数量（新）｜メーカー
リレー｜MY2N｜MY4N-D2｜4｜4｜オムロン
タイマ｜H3CR-A8｜H3CR-A8｜1｜1｜パナソニック
ソケット｜PYF14A｜PYF14A｜2｜2｜IDEC
端子台｜XW2B-20G4｜｜4｜｜オムロン
ランプ｜L-1｜｜1｜｜IDEC`))
add('C7 copy rows with remark 位置変更 (reasoned) + untouched', cs(['リレー｜MY2N｜MY4N-D2｜オムロン｜4', 'タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2', 'ランプ｜L-1｜L-1｜IDEC｜3', '端子台｜XW2B-20G4｜｜オムロン｜4'], '品名｜型式（旧）｜型式（新）｜メーカー｜数量').replace(/\n/g, '\n'))
add('C8 untouched rows with 備考 text, 3 copies', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜2｜数量変更
ランプ｜L-1｜L-1｜IDEC｜3｜数量変更
ソケット｜PYF14A｜PYF14A｜オムロン｜2｜数量変更
端子台｜XW2B-20G4｜｜オムロン｜4｜盤内
ブレーカ｜NF30｜｜三菱｜1｜盤内`))
add('C9 old/new + new column with － for untouched, 3 copies', T(`品名｜型式（旧）｜型式（新）｜数量
リレー｜MY2N｜MY4N-D2｜4
タイマ｜H3CR-A8｜H3CR-A8｜2
ランプ｜L-1｜L-1｜3
ソケット｜PYF14A｜PYF14A｜2
端子台｜XW2B-20G4｜－｜4
ブレーカ｜NF30｜－｜1`))
add('C10 plain BOM with 旧/新 numeric only (qty versions), untouched empty', T(`品名｜型式｜数量（旧）｜数量（新）
リレー｜MY4N-D2｜4｜6
タイマ｜H3CR-A8｜1｜1
ランプ｜L-1｜2｜
端子台｜XW2B-20G4｜4｜
ソケット｜PYF14A｜2｜2`), ['MY4N-D2:6', 'H3CR-A8:1', 'L-1:2', 'XW2B-20G4:4', 'PYF14A:2'])

// ---------- D 製作台数
const body3 = `リレー｜MY4N-D2｜オムロン｜2\nタイマ｜H3CR-A8｜オムロン｜1`
const hdrU = (q) => `品名｜型式｜メーカー｜${q}`
add('D1 title cell 製作台数：3台 + 員数', T(`製作台数：3台\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D2 title cells 製作台数｜3', T(`盤名｜制御盤A｜製作台数｜3\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D3 vertical block', T(`盤名｜製作台数\n制御盤A｜3\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D4 right of header (製作台数｜3)', T(`品名｜型式｜メーカー｜員数｜製作台数｜3\nリレー｜MY4N-D2｜オムロン｜2\nタイマ｜H3CR-A8｜オムロン｜1`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D5 columns 員数/台 + 製作台数', T(`品名｜型式｜メーカー｜員数/台｜製作台数\nリレー｜MY4N-D2｜オムロン｜2｜3\nタイマ｜H3CR-A8｜オムロン｜1｜3`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D6 数量(1台分) + 製作台数 3台', T(`製作台数｜3台\n${hdrU('数量(1台分)')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D7 fullwidth ３台', T(`製作台数：３台\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D8 台数：3 (no 台)', T(`台数：3\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D9 製作台数 3 台 (spaces in one cell)', T(`製作台数 3 台\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D10 数量 (plain) + 製作台数：3台 (not multiplied?)', T(`製作台数：3台\n${hdrU('数量')}\n${body3}`))
add('D11 製作台数：3台＋予備1台 + 員数', T(`製作台数：3台＋予備1台\n${hdrU('員数')}\n${body3}`))
add('D12 製作台数 1台 + 員数 (x1 no warn)', T(`製作台数：1台\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:2', 'H3CR-A8:1'])
add('D13 盤名と製作台数を同じセル', T(`制御盤A 製作台数：3台\n${hdrU('員数')}\n${body3}`))
add('D14 製作台数 in note line below table?', T(`${hdrU('員数')}\n${body3}\n製作台数｜3台`))
add('D15 header 員数 and 台数 column (product)', T(`品名｜型式｜員数｜台数\nリレー｜MY4N-D2｜2｜3\nタイマ｜H3CR-A8｜1｜3`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D16 数量｜製作台数 columns', T(`品名｜型式｜数量｜製作台数\nリレー｜MY4N-D2｜2｜3\nタイマ｜H3CR-A8｜1｜3`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D17 数量(1台)｜製作台数 columns', T(`品名｜型式｜数量(1台)｜製作台数\nリレー｜MY4N-D2｜2｜3\nタイマ｜H3CR-A8｜1｜3`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D18 ordinary BOM 員数 with unrelated 台数 words in title', T(`第3ライン 2台目 制御盤 部品表\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:2', 'H3CR-A8:1'])
add('D19 製作台数 right of header but 数量 plain', T(`品名｜型式｜メーカー｜数量｜製作台数｜3\nリレー｜MY4N-D2｜オムロン｜2\nタイマ｜H3CR-A8｜オムロン｜1`))
add('D20 header 製作台数 only column (数量なし)', T(`品名｜型式｜製作台数\nリレー｜MY4N-D2｜3\nタイマ｜H3CR-A8｜3`))
add('D21 製作数量｜3台 title + 台当り数量', T(`製作数量｜3台\n${hdrU('1台当り数量')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D22 title 製作台数 3台 AFTER blank line, 員数', T(`部品表\n\n製作台数：3台\n\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('D23 title 数量：3台 (ambiguous word 数量) + 員数', T(`数量：3台\n${hdrU('員数')}\n${body3}`))
add('D24 製作台数 3 in the same row as 部品表 title far right', T(`部品表｜｜｜製作台数：3\n${hdrU('員数')}\n${body3}`), ['MY4N-D2:6', 'H3CR-A8:3'])

// ---------- E 号機別数量 / 号機の語
const m3 = (hd, rows) => T(`品名｜型式｜メーカー｜${hd}\n${rows.join('\n')}`)
add('E1 two-tier 号機別数量 / 1｜2｜3', T(`品名｜型式｜メーカー｜号機別数量｜｜\n｜｜｜1｜2｜3\nリレー｜MY4N-D2｜オムロン｜2｜2｜2\nタイマ｜H3CR-A8｜オムロン｜1｜1｜1`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('E2 two-tier + 合計', T(`品名｜型式｜メーカー｜号機別数量｜｜｜合計\n｜｜｜1｜2｜3｜\nリレー｜MY4N-D2｜オムロン｜2｜2｜2｜6\nタイマ｜H3CR-A8｜オムロン｜1｜1｜1｜3`), ['MY4N-D2:6', 'H3CR-A8:3'])
add('E3 two-tier 数量 / 1号機｜2号機｜予備', T(`品名｜型式｜メーカー｜数量｜｜\n｜｜｜1号機｜2号機｜予備\nリレー｜MY4N-D2｜オムロン｜2｜2｜1\nタイマ｜H3CR-A8｜オムロン｜1｜1｜0`), ['MY4N-D2:5', 'H3CR-A8:2'])
add('E3b two-tier 数量 / 1｜2｜3｜予備', T(`品名｜型式｜メーカー｜数量｜｜｜\n｜｜｜1｜2｜3｜予備\nリレー｜MY4N-D2｜オムロン｜2｜2｜2｜1\nタイマ｜H3CR-A8｜オムロン｜1｜1｜1｜0`), ['MY4N-D2:7', 'H3CR-A8:3'])
add('E3c two-tier with unit note row (個)', T(`品名｜型式｜メーカー｜号機別数量｜｜\n｜｜｜1｜2｜3\n｜｜｜(個)｜(個)｜(個)\nリレー｜MY4N-D2｜オムロン｜2｜2｜2`))
add('E3d two-tier 合計 header only 1 row data one machine', T(`品名｜型式｜メーカー｜号機別数量｜｜\n｜｜｜1｜2｜3\nリレー｜MY4N-D2｜オムロン｜2｜｜`), ['MY4N-D2:2'])
add('E4 No.1｜No.2｜No.3', m3('No.1｜No.2｜No.3', ['リレー｜MY4N-D2｜オムロン｜2｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1｜1']), ['MY4N-D2:6', 'H3CR-A8:3'])
add('E5 1号機用｜2号機用', m3('1号機用｜2号機用', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E6 第1号機｜第2号機', m3('第1号機｜第2号機', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E7 A号機｜B号機', m3('A号機｜B号機', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E8 1号機数量｜2号機数量', m3('1号機数量｜2号機数量', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E9 #1｜#2', m3('#1｜#2', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E10 1台目｜2台目', m3('1台目｜2台目', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E11 1号｜2号', m3('1号｜2号', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E12 No.1｜No.2｜合計', m3('No.1｜No.2｜合計', ['リレー｜MY4N-D2｜オムロン｜2｜2｜4', 'タイマ｜H3CR-A8｜オムロン｜1｜1｜2']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E13 1号機用｜2号機用｜予備', m3('1号機用｜2号機用｜予備', ['リレー｜MY4N-D2｜オムロン｜2｜2｜1', 'タイマ｜H3CR-A8｜オムロン｜1｜1｜']), ['MY4N-D2:5', 'H3CR-A8:2'])
add('E14 Unit1｜Unit2', m3('Unit1｜Unit2', ['リレー｜MY4N-D2｜オムロン｜2｜2', 'タイマ｜H3CR-A8｜オムロン｜1｜1']), ['MY4N-D2:4', 'H3CR-A8:2'])
add('E15 old/new × machine: 旧No.1｜旧No.2｜新No.1｜新No.2', m3('旧No.1｜旧No.2｜新No.1｜新No.2', ['リレー｜MY4N-D2｜オムロン｜2｜2｜3｜3', 'タイマ｜H3CR-A8｜オムロン｜1｜1｜｜']))
add('E16 数量 col + No.1 col (mixed)', T(`品名｜型式｜数量｜No.1\nリレー｜MY4N-D2｜4｜2`))
add('E17 変更表: 旧1号機｜旧2号機｜新1号機｜新2号機 (V19-03 shape)', m3('1号機（旧）｜2号機（旧）｜1号機（新）｜2号機（新）', ['リレー｜MY4N-D2｜オムロン｜2｜2｜3｜3', 'タイマ｜H3CR-A8｜オムロン｜1｜1｜｜']))
add('E18 two-tier with 台数 / 1｜2 (top 台数)', T(`品名｜型式｜台数別数量｜\n｜｜1｜2\nリレー｜MY4N-D2｜2｜2`))
add('E19 two-tier top 必要数 / 1｜2｜3', T(`品名｜型式｜必要数｜｜\n｜｜1｜2｜3\nリレー｜MY4N-D2｜2｜2｜2`))
add('E20 two-tier top 号機 / 1｜2｜3 (top not qty)', T(`品名｜型式｜号機｜｜\n｜｜1｜2｜3\nリレー｜MY4N-D2｜2｜2｜2`))
add('E21 ordinary BOM, first data row number-only qty cell', T(`品名｜型式｜数量\nリレー｜MY4N-D2｜4`), ['MY4N-D2:4'])
add('E22 ordinary BOM: first row only qty (name blank continuation)', T(`品名｜型式｜数量\n｜｜4\nタイマ｜H3CR-A8｜1`))

// ---------- F 半角カナの見出し
const kana = (h, rows) => T(`${h}\n${rows.join('\n')}`)
add('F1 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4', 'ﾀｲﾏ｜H3CR-A8｜ｵﾑﾛﾝ｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F2 ﾋﾝﾒｲ｜ｶﾀﾊﾞﾝ｜ﾒｰｶｰ｜ｺｽｳ｜ﾋﾞｺｳ', kana('ﾋﾝﾒｲ｜ｶﾀﾊﾞﾝ｜ﾒｰｶｰ｜ｺｽｳ｜ﾋﾞｺｳ', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4｜ｱﾘ', 'ﾀｲﾏ｜H3CR-A8｜ｵﾑﾛﾝ｜1｜']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F3 ﾌﾞﾋﾝﾒｲ｜ﾋﾝﾊﾞﾝ｜ｽｳﾘﾖｳ (full-size ﾖ)', kana('ﾌﾞﾋﾝﾒｲ｜ﾋﾝﾊﾞﾝ｜ｽｳﾘﾖｳ', ['ﾘﾚｰ｜MY4N-D2｜4', 'ﾀｲﾏ｜H3CR-A8｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F4 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾀﾞｲｽｳ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾀﾞｲｽｳ', ['ﾘﾚｰ｜MY4N-D2｜4', 'ﾀｲﾏ｜H3CR-A8｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F5 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ｲﾝｽﾞｳ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ｲﾝｽﾞｳ', ['ﾘﾚｰ｜MY4N-D2｜4', 'ﾀｲﾏ｜H3CR-A8｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F6 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ｽｳ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ｽｳ', ['ﾘﾚｰ｜MY4N-D2｜4', 'ﾀｲﾏ｜H3CR-A8｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F7 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ｜ﾀﾝｲ｜ｷｺﾞｳ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ｜ﾀﾝｲ｜ｷｺﾞｳ', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4｜ｺ｜KA1', 'ﾀｲﾏ｜H3CR-A8｜ｵﾑﾛﾝ｜1｜ｺ｜KT1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F8 ﾋﾝﾒｲ + Qty + DNP in ﾒｰｶｰ', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜Qty', ['反射フィルム｜RF-200｜DNP｜2', 'ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4']), ['RF-200:2', 'MY4N-D2:4'])
add('F9 ヒンメイ｜カタシキ｜スウリョウ (full-width kana)', kana('ヒンメイ｜カタシキ｜スウリョウ', ['リレー｜MY4N-D2｜4', 'タイマ｜H3CR-A8｜1']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F10 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ with 〃 and half-width digits', kana('ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜４', '〃｜H3CR-A8｜〃｜１']), ['MY4N-D2:4', 'H3CR-A8:1'])
add('F11 ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ title+totals', T(`ﾌﾞﾋﾝﾋｮｳ\nﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ\nﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4\nｺﾞｳｹｲ｜｜｜4`), ['MY4N-D2:4'])
add('F12 ﾋﾝﾒｲ(旧)｜ﾋﾝﾒｲ(新)', kana('ﾋﾝﾒｲ(ｷｭｳ)｜ﾋﾝﾒｲ(ｼﾝ)｜ｶﾀｼｷ｜ｽｳﾘｮｳ', ['ﾘﾚｰ｜ﾘﾚｰ2｜MY4N-D2｜4']))
add('F13 Half-width kana part names + ﾒｰｶ keeps', kana('品名｜型式｜メーカ｜数量', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4']), ['MY4N-D2:4'])
add('F14 Half-width ｶﾅ + ASCII English headers', kana('Name｜ｶﾀｼｷ｜Maker｜Qty', ['ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4']), ['MY4N-D2:4'])

// ---------- G 旧→新を 1 つのセルに / 型式に → を含む普通の BOM
add('G1 model MY2N→MY4N-D2', T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY2N→MY4N-D2｜オムロン｜4｜型式変更\nタイマ｜H3CR-A8｜オムロン｜1→2｜数量変更\nランプ｜L-1｜IDEC｜1｜`), ['MY4N-D2:4', 'H3CR-A8:2', 'L-1:1'])
add('G2 model ⇒ and -> and 全角＞', T(`品名｜型式｜メーカー｜数量\nリレー｜MY2N ⇒ MY4N-D2｜オムロン｜4\nタイマ｜H3CR-A ->H3CR-A8｜オムロン｜1\nランプ｜L-0＞L-1｜IDEC｜1`), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:1'])
add('G3 maker オムロン→パナソニック', T(`品名｜型式｜メーカー｜数量\nリレー｜MY4N-D2｜オムロン→パナソニック｜4`), ['MY4N-D2:4'])
add('G4 ordinary: USB-A→USB-C 変換ケーブル (model has arrow)', T(`品名｜型式｜メーカー｜数量\n変換ケーブル｜USB-A→USB-C 変換ケーブル｜エレコム｜2\nリレー｜MY4N-D2｜オムロン｜4`), ['USB-A→USB-C 変換ケーブル:2', 'MY4N-D2:4'])
add('G5 ordinary: RS232C->USB変換', T(`品名｜型式｜メーカー｜数量\n変換器｜RS232C->USB変換｜サンワ｜1`), ['RS232C->USB変換:1'])
add('G6 ordinary: D-sub9→RJ45', T(`品名｜型式｜メーカー｜数量\n変換コネクタ｜D-sub9→RJ45｜サンワ｜1`), ['D-sub9→RJ45:1'])
add('G7 ordinary: 継手 PT1/4>φ6 (greater-than in model)', T(`品名｜型式｜メーカー｜数量\nフィッティング｜PT1/4>φ6｜SMC｜4`), ['PT1/4>φ6:4'])
add('G8 ordinary: model with (A→B) remark', T(`品名｜型式｜メーカー｜数量\nケーブル｜UL1007 AWG22 (赤→黒)｜フジクラ｜10`), ['UL1007 AWG22 (赤→黒):10'])
add('G9 ordinary: メーカ with 旧→新 inside name', T(`品名｜型式｜メーカー｜数量\nリレー｜MY4N-D2｜オムロン(旧→新)｜4`))
add('G10 ordinary: note with → arrows untouched', T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜MY2N→MY4N-D2に変更`), ['MY4N-D2:4'])
add('G11 qty "1→2" and "4→0"', T(`品名｜型式｜数量\nリレー｜MY4N-D2｜4→0\nタイマ｜H3CR-A8｜1→2`))
add('G12 model "->" at end (MY4N->)', T(`品名｜型式｜数量\nリレー｜MY4N->｜4`))
add('G13 model arrow with empty right (MY2N→)', T(`品名｜型式｜数量\nリレー｜MY2N→｜4`))
add('G14 ordinary: ケーブル 型式 "SGP-6→2.5m" ', T(`品名｜型式｜数量\nケーブル｜CV 2sq 3C→端末処理｜10`))
add('G15 model with ">" as 以上 (>=100V)', T(`品名｜型式｜数量\nダイオード｜1N4007 (>100V)｜10`))

// ---------- H Description / Comment / 部品名の空の行
add('H1 Altium: Comment｜Description blank', T(`Comment｜Description｜Designator｜Quantity｜Manufacturer｜Manufacturer Part Number\n10k｜Chip Resistor｜R1, R2｜2｜KOA｜RK73H1JTTD1002F\nLED_Red｜｜D1｜1｜Rohm｜SML-310LTT86`), ['RK73H1JTTD1002F:2', 'SML-310LTT86:1'])
add('H2 Item｜Description｜Qty｜MPN (Item = line no.)', T(`Item｜Description｜Qty｜MPN\n1｜Chip Resistor｜2｜RK73H1JTTD1002F\n2｜LED Red｜1｜SML-310LTT86`), ['RK73H1JTTD1002F:2', 'SML-310LTT86:1'])
add('H3 Item No.｜品名｜型式｜数量 (Item No. numeric)', T(`Item No.｜品名｜型式｜数量\n1｜リレー｜MY4N-D2｜4\n2｜タイマ｜H3CR-A8｜1`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('H4 品目｜品名｜型式｜数量 (品目 numeric codes)', T(`品目｜品名｜型式｜数量\n1001｜リレー｜MY4N-D2｜4\n1002｜タイマ｜H3CR-A8｜1`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('H5 Comment｜Value｜Qty', T(`Comment｜Value｜Qty\nRes｜10k｜2\nCap｜100n｜4`))
add('H6 Description｜Comment｜Qty, Comment empty', T(`Description｜Comment｜Qty\nChip Resistor｜｜2\nLED｜Red｜1`))
add('H7 品名 blank rows + Value present (continuation)', T(`品名｜Value｜型式｜数量\n抵抗｜10k｜RK73｜2\n｜22k｜RK73-22｜2`))
add('H8 コメント｜品名｜型式｜数量 (Japanese コメント)', T(`コメント｜品名｜型式｜数量\n要確認｜リレー｜MY4N-D2｜4`), ['MY4N-D2:4'])
add('H9 KiCad Reference｜Value｜Footprint｜Qty｜Description', T(`Reference｜Value｜Footprint｜Qty｜Description\nR1,R2｜10k｜R_0603｜2｜Resistor\nC1｜100n｜C_0603｜1｜Capacitor`))
add('H10 Altium Description empty and Comment empty', T(`Comment｜Description｜Designator｜Quantity\n｜｜R1｜2`))
add('H11 Altium: Designator｜Comment｜Footprint｜Description｜Quantity (Comment first value)', T(`Designator｜Comment｜Footprint｜Description｜Quantity\nR1, R2｜10k｜0603｜Resistor｜2\nU1｜LM358｜SOIC8｜Op Amp｜1`))
add('H12 変更内容 column (note) and 備考 both', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜備考\nリレー｜MY2N｜MY4N-D2｜4｜型式変更｜盤内\nタイマ｜H3CR-A8｜｜1｜｜盤内`), ['MY4N-D2:4', 'H3CR-A8:1'])
add('H13 変更理由 as note and 削除 in 備考', T(`品名｜型式（旧）｜型式（新）｜数量｜変更理由｜備考\nリレー｜MY2N｜MY4N-D2｜4｜廃番のため｜\nタイマ｜H3CR-A8｜｜1｜｜削除`), ['MY4N-D2:4'])
add('H14 変更理由 col with 廃止のため (not deletion)', T(`品名｜型式（旧）｜型式（新）｜数量｜変更理由\nリレー｜MY2N｜MY4N-D2｜4｜MY2N廃止のため\nタイマ｜H3CR-A8｜｜1｜`), ['MY4N-D2:4', 'H3CR-A8:1'])

fs.writeFileSync('/home/user/BOM/usertest/newbie/r20/cases/p20.json', JSON.stringify(cases, null, 1))
console.log(cases.length)
