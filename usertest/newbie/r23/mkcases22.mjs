// ラウンド22: 画面（ガイド「1 貼り付け」）で流す入力 → cases/p22sel.json  [title, text]
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const c = []
const add = (t, text) => c.push([t, text])
const note = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
部品1｜P-10｜｜オムロン｜1｜${n}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
for (const n of ['削除（客先回答待ち）', '削除（pending）', '削除（使用中）', '削除（削除しない予定）', '削除（まだしない）', '削除（under review）', '削除（客先確認中）', '削除（保留）', '削除（確認済）', '全て削除', 'この部品は削除', 'この部品を削除してください', '削除予定']) add(`N-note 「${n}」`, note(n))
const kind = (a, b, c2, d) => T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
${a}｜リレー｜MY2N｜MY4N-D2｜4
${b}｜タイマ｜H3CR-A8｜｜1
${c2}｜端子台｜｜XW2B-20G4｜4
${d}｜ヒューズ｜F-5A｜｜3`)
add('K-kind 型式変更/削除/追加/据え置き', kind('型式変更', '削除', '追加', '据え置き'))
add('K-kind 変更/削除/追加/継続使用', kind('変更', '削除', '追加', '継続使用'))
add('K-kind Change/Remove/Add/No change', kind('Change', 'Remove', 'Add', 'No change'))
add('K-kind 数量変更/削除/新設/変更なし', kind('数量変更', '削除', '新設', '変更なし'))
add('K-kind 変更/削除/追加/変更なし（正常）', kind('変更', '削除', '追加', '変更なし'))
const arrow = (m, n) => T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン｜4｜
変換ケーブル｜${m}｜サンワ｜1｜${n}
端子台｜XW2B-20G4｜オムロン｜4｜`)
add('A-arrow DVI→HDMI 備考なし', arrow('DVI→HDMI', ''))
add('A-arrow DVI→HDMI 備考「交換用」', arrow('DVI→HDMI', '交換用'))
add('A-arrow USB-A→USB-C 備考「取付位置は図面参照」', arrow('USB-A→USB-C', '取付位置は図面参照'))
add('A-arrow USB-A→USB-C 備考「追加購入品」', arrow('USB-A→USB-C', '追加購入品'))
const titles = (n, extra) => Array.from({ length: n }, (_, i) => `プロジェクト${i}: ○○盤, 担当: 山田, 日付: 2026/10/25`).join('\n')
const body = '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t1\n端子台\tXW2B-20G4\tオムロン\t4\nヒューズ\tF-5A\tミスミ\t10'
add('D-tsv title commas 5 lines', titles(5) + '\n' + body)
add('D-tsv title commas 8 lines', titles(8) + '\n' + body)
add('D-tsv notes below 8 lines', body + '\n' + titles(8))
add('D-tsv designators 8 rows each 6 commas', '回路記号\t品名\t型式\t数量\n' + Array.from({ length: 8 }, (_, i) => `C${i}1, C${i}2, C${i}3, C${i}4, C${i}5, C${i}6, C${i}7\tコンデンサ\tGRM188-${i}\t7`).join('\n'))
const dnp = (n) => T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン｜4｜
タイマ｜H3CR-A8｜オムロン｜1｜${n}`)
for (const n of ['(未実装)', '※未実装', '【未実装】', '実装しません', 'DNP 製（大日本印刷）', 'DNP 将来用', 'DNP将来用', 'DNP部品']) add(`P-dnp 備考「${n}」`, dnp(n))
const col = (h, v) => T(`品名｜型式｜メーカー｜数量｜${h}
リレー｜MY4N-D2｜オムロン｜4｜${v[0]}
タイマ｜H3CR-A8｜オムロン｜1｜${v[1]}
端子台｜XW2B-20G4｜オムロン｜4｜${v[2]}`)
add('O-ordinary 区分 D/D/D', col('区分', ['D', 'D', 'D']))
add('O-ordinary 対応 ×/(空)/(空)', col('対応', ['×', '', '']))
add('O-ordinary Action x/(空)/(空)', col('Action', ['x', '', '']))
add('O-ordinary 変更 ○/×/○（正常）', col('変更', ['○', '×', '○']))
fs.mkdirSync('cases', { recursive: true })
fs.writeFileSync('cases/p22sel.json', JSON.stringify(c))
console.log(c.length)
// ---- 第 2 組
{
  const c2 = []
  const add2 = (t, text) => c2.push([t, text])
  add2('Z-arrow 見出し「型式（旧→新）」', T(`品名｜型式（旧→新）｜メーカー｜数量
リレー｜MY2N→MY4N-D2｜オムロン｜4
タイマ｜H3CR-A7→H3CR-A8｜オムロン｜1
端子台｜XW2B-20G4｜オムロン｜4`))
  add2('Z-arrow 変更区分の列', T(`変更区分｜品名｜型式｜メーカー｜数量
変更｜リレー｜MY2N→MY4N-D2｜オムロン｜4
変更｜タイマ｜H3CR-A7→H3CR-A8｜オムロン｜1
変更なし｜端子台｜XW2B-20G4｜オムロン｜4`))
  // CSV の複数行セル（品名の 2 行目にコンマ・備考も複数行）
  const q = (c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
  const csv = (rows) => rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n'
  add2('Z-csv 複数行セル 品名2行目にコンマ＋備考複数行', csv([['品名', '型式', '数量', '備考'], ['リレー\n24V, 4極', 'MY4N-D2', '4', '盤内上段\n要確認'], ['タイマ', 'H3CR-A8', '1', ''], ['端子台\n20極, 黒', 'XW2B-20G4', '4', '納期注意\n代替可']]))
  add2('Z-csv 複数行セル（OK の形: 備考だけ複数行）', csv([['品名', '型式', '数量', '備考'], ['リレー', 'MY4N-D2', '4', '盤内上段\n要確認, 納期'], ['タイマ', 'H3CR-A8', '1', '']]))
  // 変更図で新の型式に 削除（保留）
  add2('Z-newmodel 削除（保留）', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜削除（保留）｜オムロン｜1
端子台｜XW2B-20G4｜｜オムロン｜4`))
  add2('Z-newmodel 撤去（再取付）', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜撤去（再取付）｜オムロン｜1
端子台｜XW2B-20G4｜｜オムロン｜4`))
  // 変更内容の文章
  add2('Z-変更内容 「タイマを削除」', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜
タイマ｜H3CR-A8｜｜1｜タイマを削除｜盤内
端子台｜XW2B-20G4｜｜4｜｜`))
  add2('Z-見出し「変更の内容」に削除', T(`品名｜型式（旧）｜型式（新）｜数量｜変更の内容｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜
タイマ｜H3CR-A8｜｜1｜削除｜盤内
端子台｜XW2B-20G4｜｜4｜｜`))
  fs.writeFileSync('cases/p22sel2.json', JSON.stringify(c2))
  console.log('p22sel2', c2.length)
}
