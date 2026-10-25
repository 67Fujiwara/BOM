import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = []
const add = (t, text, exp) => cases.push(exp ? [t, text, exp] : [t, text])
const nm = (v) => T(`品名（旧）｜品名（新）｜型式｜メーカー｜数量\n工具｜${v}｜TR-10｜X｜1\nリレー｜｜MY4N-D2｜オムロン｜4`)
for (const v of ['取外しカバー', '撤去工具', '不要品回収箱', '中止ボタン', '削除用ツール', '廃止品置場', '欠番表示板', 'Delタイマ', 'Remove Tool', '取止めバンド']) add(`V-newname keep 「${v}」`, nm(v), ['TR-10:1', 'MY4N-D2:4'])
for (const v of ['削除', '削除済', '削除品', '撤去', '廃止', '不要', '欠番', '取止め', '中止', 'Del', '×']) add(`V-newname del 「${v}」`, nm(v), ['MY4N-D2:4'])
const md = (v) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量\nリレー｜MY2N｜MY4N-D2｜オムロン｜4\nタイマ｜H3CR-A8｜${v}｜オムロン｜1`)
for (const v of ['削除しました', '削除してください', 'Del.', '→削除', '削除（不要）', '廃止済', '撤去済み', '取外し済', '不使用', 'なし', '-', '－']) add(`V-newmodel 「${v}」`, md(v))
// 備考の削除語 + 新の型式あり (書き写した行)
const cp = (w) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考\nリレー｜MY2N｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜H3CR-A8｜オムロン｜1｜${w}\nランプ｜L-1｜L-1｜IDEC｜2｜`)
for (const w of ['削除', '削除済', '削除しました', '不要のため削除', '削除しない', '']) add(`V-copyrow note 「${w}」`, cp(w))
// 半角カナ数量
add('V-qty halfwidth ｺ', T(`品名｜型式｜数量\nリレー｜MY4N-D2｜4ｺ\nタイマ｜H3CR-A8｜２ｺ`), ['MY4N-D2:4', 'H3CR-A8:2'])
add('V-qty 4個 5本 3ヶ', T(`品名｜型式｜数量\nリレー｜MY4N-D2｜4個\nケーブル｜CV｜5本\nタイマ｜H3CR-A8｜3ヶ`), ['MY4N-D2:4', 'CV:5', 'H3CR-A8:3'])
fs.writeFileSync('cases/p20c.json', JSON.stringify(cases, null, 1)); console.log(cases.length)
