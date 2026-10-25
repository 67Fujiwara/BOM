// ラウンド23 n15: ラウンド22 の新人項目（N22-05/08/09, U22-04/05/06/07）の再確認（解析）
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const out = []
const show = (t, text) => { const o = old.parseBomPaste(text), r = neu.parseBomPaste(text); out.push(`## ${t}\n   old(68e45f7): ${o.rows.map(lab).join(' ')} | ${o.mapping.map((m) => m ?? '-').join(',')}\n   new: ${r.rows.map(lab).join(' ')} | ${r.mapping.map((m) => m ?? '-').join(',')}\n   warn: ${r.warnings.map((w) => w.slice(0, 80)).join(' / ')}`) }
// N22-09: 変更内容系の見出し
for (const h of ['変更内容', '変更の内容', '変更事項', '変更箇所', '設変内容', '改訂内容', '修正内容', '内容', '理由', '変更理由', '変更点', '変更概要', '変更詳細', '設計変更内容', '変更メモ', 'コメント', 'Comment', 'Remarks', 'Reason', 'Description']) {
  show(`N22-09 見出し「${h}」に「削除」/「タイマを削除」`, T(`品名｜型式（旧）｜型式（新）｜数量｜${h}\nリレー｜MY2N｜MY4N-D2｜4｜型式変更\nタイマ｜H3CR-A8｜｜1｜削除\nランプ｜PL-24｜｜2｜ランプを削除\n端子台｜XW2B-20G4｜｜4｜`))
}
// N22-05: 旧→新
show('N22-05 見出し「型式（旧→新）」', T(`品名｜型式（旧→新）｜数量\nリレー｜MY2N→MY4N-D2｜4\nタイマ｜H3CR-A7→H3CR-A8｜1\n端子台｜XW2B-20G4｜4`))
show('N22-05 見出し「型式」で矢印だけ（変更の証拠なし）', T(`品名｜型式｜数量\nリレー｜MY2N→MY4N-D2｜4\nタイマ｜H3CR-A7→H3CR-A8｜1\n端子台｜XW2B-20G4｜4`))
show('N22-05 変更区分の列＋矢印', T(`変更区分｜品名｜型式｜数量\n変更｜リレー｜MY2N→MY4N-D2｜4\n変更｜タイマ｜H3CR-A7→H3CR-A8｜1\n追加｜端子台｜XW2B-20G4｜4`))
show('N22-05 見出し「変更前→変更後」', T(`品名｜型式（変更前→変更後）｜数量\nリレー｜MY2N→MY4N-D2｜4\n端子台｜XW2B-20G4｜4`))
// U22-04: 調達区分
for (const h of ['調達区分', '調達', '手配区分', '調達方法', '調達種別', '手配方法']) show(`U22-04 見出し「${h}」支給品/社内在庫/相見積`, T(`品名｜型式｜メーカー｜数量｜${h}\nリレー｜MY4N-D2｜オムロン｜4｜相見積\nタイマ｜H3CR-A8｜オムロン｜1｜支給品\nランプ｜PL-24｜IDEC｜2｜社内在庫\n端子台｜XW2B-20G4｜オムロン｜4｜客先指定品`))
// U22-05: CSV セルの中のタブ
show('U22-05 CSV セルにタブ', '品名,型式,数量,備考\nリレー,MY4N-D2,4,"盤内上段\t左側"\nタイマ,H3CR-A8,1,')
// U22-06: 半角カナの合計
show('U22-06 半角カナ ｺﾞｳｹｲ / ｼｮｳｹｲ', T(`ﾋﾝﾒｲ｜ｶﾀｼｷ｜ﾒｰｶｰ｜ｽｳﾘｮｳ\nﾘﾚｰ｜MY4N-D2｜ｵﾑﾛﾝ｜4\nﾀｲﾏ｜H3CR-A8｜ｵﾑﾛﾝ｜1\nｼｮｳｹｲ｜｜｜5\nｺﾞｳｹｲ｜｜｜5`))
// N22-08: CSV 複数行セル（2 つ・2 つ目にコンマ）
show('N22-08 CSV 複数行セル 2 つ', '品名,型式,メーカー,数量,備考\n"リレー\n24V, 2a",MY4N-D2,オムロン,4,"盤内\n上段, 左"\nタイマ,H3CR-A8,オムロン,1,\n"ランプ\n赤, 緑",PL-24,IDEC,2,"予備\n2個, 別手配"\n')
// U22-07: 新の型式に削除の文
for (const w of ['削除してよいか確認', '削除？', '全削除', '一部削除', '削除かも', '削除しない']) show(`U22-07 新の型式「${w}」`, T(`品名｜型式（旧）｜型式（新）｜数量\nリレー｜MY2N｜MY4N-D2｜4\nタイマ｜H3CR-A8｜${w}｜1\n端子台｜XW2B-20G4｜｜4`))
fs.writeFileSync('results/n15_r22_items.out', out.join('\n') + '\n')
console.log(out.join('\n'))
