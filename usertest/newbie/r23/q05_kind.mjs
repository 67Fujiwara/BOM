// ラウンド22 q05: 変更区分の見出し・値（変更タイプ／Change Type／設変区分／対応／Action）と、○/× の列・ふつうの BOM に紛れる「変更」「対応」「Action」の列
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
const run = (title, t, exp) => {
  const o = old.parseBomPaste(t), r = neu.parseBomPaste(t)
  const a = r.rows.map(lab), b = o.rows.map(lab)
  const ok = exp ? (JSON.stringify(a) === JSON.stringify(exp) ? 'OK' : 'MISMATCH') : 'INFO'
  out.push(`[${title}] ${ok}${JSON.stringify(a) !== JSON.stringify(b) ? ' (old≠new)' : ''}\n   new: ${a.join(' ')}${exp && ok !== 'OK' ? '\n   exp: ' + exp.join(' ') : ''}${JSON.stringify(a) !== JSON.stringify(b) ? '\n   old: ' + b.join(' ') : ''}\n   warn: ${r.warnings.join(' / ').slice(0, 300)}`)
  return ok
}
// A 変更図で見出しのバリエーション × 値
const hdrs = ['変更タイプ', 'Change Type', 'ChangeType', '設変区分', '設変', '対応', 'Action', 'Rev区分', '修正区分', 'ECN Type', 'ECN区分', '変更種別', '変更の種類', '改訂区分', '処置', '処置区分', '種別', '区分', 'Status', 'ステータス', '状態', '変更有無', '変更の有無', '変更フラグ', '変更ステータス', 'Change', 'CHG', '変更点区分', '変更理由区分', '修正', 'Modify', 'Mod', 'ECO区分', 'ECO', 'ECN', '設計変更区分', '設変内容区分', '設変タイプ']
for (const h of hdrs) {
  const t = T(`${h}｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
削除｜タイマ｜H3CR-A8｜｜1
変更なし｜端子台｜XW2B-20G4｜｜4`)
  run(`A-hdr 「${h}」（値 削除）`, t, ['MY4N-D2:4', 'XW2B-20G4:4'])
}
// B 値（見出し 変更区分）
const vals = ['削除', '削除済', 'Deleted', 'DEL', 'Del', 'D', 'd', '×', 'x', 'X', 'Ｘ', '✗', '✕', '廃止', '廃番', '撤去', '取外し', '取り外し', '不要', '不使用', 'remove', 'REMOVE', 'Removed', 'Delete', 'DELETE', '削', '消', '除却', '除外', '抹消', '欠番', '削除(R012へ)', '削除（Rev.2）', '削除済(Rev.2)', 'DEL.', '削除予定', '削除対象', '削除品', '削除する', '削除します', '撤去済', '廃止品', '廃止予定', '取止め', '中止', 'キャンセル', 'cancel', 'Cancel', 'obsolete', 'OBS', 'EOL', 'NA', 'N/A', '無', 'なし', '－', '-', '▲', '△', '▼', '↓', '✖', '🗑', 'カット', 'CUT', 'cut', 'ー', '―', '全削除', '一部削除', '削除？', '削除保留', '削除しない', '削除不要', '削除（保留）']
for (const v of vals) {
  const t = T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
${v}｜タイマ｜H3CR-A8｜｜1
変更なし｜端子台｜XW2B-20G4｜｜4`)
  run(`B-val 区分「${v}」`, t)
}
// C ふつうの BOM に紛れる列
const ordCols = [['変更', ['○', '×', '○']], ['変更', ['○', '', '×']], ['変更', ['×', '', '']], ['対応', ['○', '×', '○']], ['対応', ['×', '', '']], ['Action', ['×', '', '']], ['Action', ['○', '×', '']], ['区分', ['D', 'A', 'B']], ['区分', ['D', '', '']], ['種別', ['×', '○', '']], ['処置', ['×', '', '']], ['変更', ['x', '', '']], ['Change', ['d', '', '']], ['変更', ['不要', '', '']], ['対応', ['不要', '対応', '']], ['対応', ['不要', '', '']], ['区分', ['不要', '', '']], ['種別', ['廃止', '', '']], ['区分', ['廃止', '購入', '購入']], ['状態', ['廃止', '', '']], ['Status', ['Deleted', '', '']], ['在庫', ['×', '○', '']], ['Fitted', ['×', '○', '']], ['購入', ['×', '○', '○']]]
for (const [h, v] of ordCols) {
  const t = T(`品名｜型式｜数量｜${h}
リレー｜MY4N-D2｜4｜${v[0]}
タイマ｜H3CR-A8｜1｜${v[1]}
端子台｜XW2B-20G4｜4｜${v[2]}`)
  run(`C-ordinary col 「${h}」 ${v.join('/')}`, t, ['MY4N-D2:4', 'H3CR-A8:1', 'XW2B-20G4:4'])
}
fs.writeFileSync('results/q05_kind.out', out.join('\n') + '\n')
const s = out.filter((x) => x.includes('MISMATCH')).length
console.log(out.filter((x) => x.includes('MISMATCH')).join('\n'))
console.log('mismatch', s)
