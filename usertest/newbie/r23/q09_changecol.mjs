// ラウンド22 q09: 変更内容／変更理由／変更点の列に削除があり、備考が別にある表（列の順・複数の組み合わせ）
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
let bad = 0
const run = (title, t, exp) => {
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const a = r.rows.map(lab), b = o.rows.map(lab)
  const ok = exp ? (JSON.stringify(a) === JSON.stringify(exp) ? 'OK' : 'MISMATCH') : 'INFO'
  if (ok === 'MISMATCH') bad++
  out.push(`[${title}] ${ok}${JSON.stringify(a) !== JSON.stringify(b) ? ' (old≠new)' : ''}\n   new: ${a.join(' ')} | map=${r.mapping.map((m) => m ?? '-').join(',')}${ok === 'MISMATCH' ? '\n   exp: ' + exp.join(' ') : ''}${JSON.stringify(a) !== JSON.stringify(b) ? '\n   old: ' + b.join(' ') : ''}\n   warn: ${r.warnings.join(' / ').slice(0, 250)}`)
}
const E = ['MY4N-D2:4', 'XW2B-20G4:4']
const cc = ['変更内容', '変更理由', '変更点', '変更概要', '変更の内容', '変更の理由', '変更事項', '変更箇所', '変更内容/理由', '設変内容', '改訂内容', '修正内容', '備考2', 'コメント', 'Comment', 'Remarks', 'Note', 'メモ', '理由', '内容']
for (const h of cc) for (const order of ['cc-note', 'note-cc']) {
  const cols = order === 'cc-note' ? [h, '備考'] : ['備考', h]
  const mk = (a, b) => (order === 'cc-note' ? [a, b] : [b, a])
  const t = T(`品名｜型式（旧）｜型式（新）｜数量｜${cols.join('｜')}
リレー｜MY2N｜MY4N-D2｜4｜${mk('型式変更', '盤内上段').join('｜')}
タイマ｜H3CR-A8｜｜1｜${mk('削除', '盤内下段').join('｜')}
端子台｜XW2B-20G4｜｜4｜${mk('', '').join('｜')}`)
  run(`${h} / ${order}`, t, E)
}
// 備考の列だけに「削除」、変更内容に別の語
for (const d of ['削除', '削除済', '廃止', '不要', '撤去', '取外し']) {
  run(`変更内容=変更なし 備考=${d}`, T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜
タイマ｜H3CR-A8｜｜1｜変更なし｜${d}
端子台｜XW2B-20G4｜｜4｜｜`), E)
}
// 3 列（変更内容・変更理由・備考）
run('3列 変更内容=削除', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜変更理由｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜廃番｜
タイマ｜H3CR-A8｜｜1｜削除｜不要｜
端子台｜XW2B-20G4｜｜4｜｜｜`), E)
run('3列 変更理由=削除', T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜変更理由｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜廃番｜
タイマ｜H3CR-A8｜｜1｜｜削除｜
端子台｜XW2B-20G4｜｜4｜｜｜`), E)
// 変更内容に文章
for (const s of ['H3CR-A8 を削除', 'タイマを削除', 'タイマ削除', 'タイマ撤去', 'タイマは不要', 'タイマ不要', '削除します', 'このタイマは削除', 'タイマを削除する', '不要のため削除', '削除（H3CR-A8）', 'タイマ → 削除', 'タイマ廃止', '廃止']) {
  run(`変更内容文章「${s}」`, T(`品名｜型式（旧）｜型式（新）｜数量｜変更内容｜備考
リレー｜MY2N｜MY4N-D2｜4｜型式変更｜
タイマ｜H3CR-A8｜｜1｜${s}｜盤内
端子台｜XW2B-20G4｜｜4｜｜`), E)
}
fs.writeFileSync('results/q09_changecol.out', out.join('\n') + `\nMISMATCH ${bad}\n`)
console.log(out.filter((x) => /\] MISMATCH/.test(x.split('\n')[0])).map((x) => x.split('\n').slice(0, 3).join('\n')).join('\n'))
console.log('MISMATCH', bad)
