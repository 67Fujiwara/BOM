// ラウンド23 n16: 表の下の注記・署名・ページ番号・改訂履歴の行（削除・撤去・廃止の語を含む）が部品になるか。旧 68e45f7 と新
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const base = (extra, shape = 'change') => shape === 'change'
  ? T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考\nリレー｜MY2N｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜｜オムロン｜1｜削除\n端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4｜\n${extra}`)
  : T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\n端子台｜XW2B-20G4｜オムロン｜4｜\n${extra}`)
const feet = ['※削除部品は取り込まないこと', '注) 削除品は赤字で表示', '※1 撤去品は別紙参照', '備考: 廃止予定の部品は別途協議', '以上', '以上です', '承認: 部長｜課長｜係長', '作成: 山田｜検図: 鈴木', '- 1 -', 'Page 2/3', '改訂履歴: Rev.A 初版 / Rev.B 削除1件', 'Rev.B 2026/10/20 山田 タイマ削除', '(次ページへ続く)', '※赤字は変更箇所', '削除｜H3CR-A8', '以下余白', '＊印は客先支給', '（注）数量は1台分']
const out = []
for (const shape of ['change', 'ordinary']) for (const f of feet) {
  const t = base(f.split('｜').join('\t').replace(/\t/g, '｜').split('｜').join('\t') === f ? f : f.split('｜').join('｜'), shape)
  const tt = base(f, shape)
  const o = old.parseBomPaste(tt), r = neu.parseBomPaste(tt)
  const extra = r.rows.filter((x) => !['リレー', 'タイマ', '端子台'].includes(x.name))
  out.push(`${shape} 「${f}」 old=${o.rows.map(lab).join(' ')} | new=${r.rows.map(lab).join(' ')}${extra.length ? '  <<部品になった' : ''}`)
}
fs.writeFileSync('results/n16_footnotes.out', out.join('\n') + '\n')
console.log(out.join('\n'))
