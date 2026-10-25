// ラウンド19: 変更図 その 8（書き写し／変えた行だけの見分け・変更区分の列・備考だけの削除）→ cases/p19b.json
import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = [
  ['K1 kubun-col-tsuika-henkou-sakujo', T(`区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜｜1
追加｜ランプ｜｜L-1｜2
｜端子台｜XW2B-20G4｜｜4`)],
  ['K2 henkou-kubun-col', T(`品名｜型式（旧）｜型式（新）｜数量｜変更区分
リレー｜MY2N｜MY4N-D2｜4｜変更
タイマ｜H3CR-A8｜｜1｜削除
ランプ｜｜L-1｜2｜追加
端子台｜XW2B-20G4｜｜4｜`)],
  ['K3 henkou-kubun-only-new-cols', T(`品名｜型式｜メーカー｜数量｜変更区分
リレー｜MY4N-D2｜オムロン｜4｜変更
タイマ｜H3CR-A8｜オムロン｜1｜削除
ランプ｜L-1｜IDEC｜2｜追加
端子台｜XW2B-20G4｜オムロン｜4｜`)],
  ['K4 full-copy-delete-in-note-only', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜型式変更
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜1｜削除
ソケット｜PYF14A｜PYF14A｜オムロン｜2｜
端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4｜`)],
  ['K5 full-copy-more-deletions-than-copies', T(`品名｜型式（旧）｜型式（新）｜数量（旧）｜数量（新）
リレー｜MY2N｜MY4N-D2｜4｜4
タイマ｜H3CR-A8｜H3CR-A8｜1｜1
ソケット｜PYF14A｜PYF14A｜2｜2
ランプ｜L-1｜｜1｜
ブレーカ｜NF32-SV｜｜1｜
ヒューズ｜F-5A｜｜3｜
端子台｜XW2B-20G4｜｜4｜`)],
  ['K6 sparse-maker-only-change-copies', T(`品名｜型式（旧）｜型式（新）｜数量（旧）｜数量（新）｜メーカー
リレー｜MY2N｜MY4N-D2｜4｜4｜オムロン
タイマ｜H3CR-A8｜H3CR-A8｜1｜1｜パナソニック
ソケット｜PYF14A｜PYF14A｜2｜2｜IDEC
端子台｜XW2B-20G4｜｜4｜｜オムロン
ランプ｜L-1｜｜1｜｜IDEC`)],
]
fs.writeFileSync(new URL('./cases/p19b.json', import.meta.url), JSON.stringify(cases, null, 1))
console.log(cases.length)
