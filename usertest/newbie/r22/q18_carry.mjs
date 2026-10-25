// ラウンド22 q18: ラウンド21 の項目の持ち越し確認（N21-03/04/05/07/08/10/11、U21-02/05/06/07）を解析で
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const show = (title, t) => { const r = neu.parseBomPaste(t), o = old.parseBomPaste(t); console.log(`[${title}]\n   new: ${r.rows.map(lab).join(' ')}\n   old: ${o.rows.map(lab).join(' ')}\n   warn: ${r.warnings.join(' / ').slice(0, 200)}`) }
show('N21-07 結合セル 空欄の区分 (削除が3行ぶん)', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜｜1
｜ランプ｜L-1｜｜2
｜ソケット｜PYF14A｜｜2
追加｜端子台｜｜XW2B-20G4｜4`))
show('N21-03 そのまま/No change/変更なし 混在', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量（旧）｜数量（新）
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜4
タイマ｜H3CR-A8｜そのまま｜オムロン｜1｜そのまま
端子台｜XW2B-20G4｜No change｜オムロン｜4｜No change
ランプ｜L-1｜変更なし｜IDEC｜2｜変更なし
ソケット｜PYF14A｜PYF14A｜オムロン｜2｜2
ヒューズ｜F-5A｜｜ミスミ｜3｜`))
show('N21-03 「－」の行（書き写しの表）', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
タイマ｜H3CR-A8｜H3CR-A8｜オムロン｜1
端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4
ランプ｜L-1｜－｜IDEC｜2
ソケット｜PYF14A｜－｜オムロン｜2`))
show('U21-05 半角カナ数量見出し', T(`ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｼﾖｳｽｳ
ﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4`))
show('U21-05 Unit1 ユニット1 Machine1', T(`品名｜型式｜メーカー｜ユニット1｜ユニット2
リレー｜MY4N-D2｜オムロン｜2｜3`))
show('U21-05 第一号機', T(`品名｜型式｜メーカー｜第一号機｜第二号機
リレー｜MY4N-D2｜オムロン｜2｜3`))
show('U21-07 変更区分の値が全部読めない', T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
改｜リレー｜MY2N｜MY4N-D2｜4
消｜タイマ｜H3CR-A8｜｜1`))
