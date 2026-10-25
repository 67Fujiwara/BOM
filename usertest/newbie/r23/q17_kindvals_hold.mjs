// ラウンド22 q17: 変更区分の列に「削除（保留）」など保留・否定つきの言い方 → 黙って削除にならないか
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const vals = ['削除（保留）', '削除(保留)', '削除（要確認）', '削除（客先回答待ち）', '削除（しない）', '撤去（再取付）', '削除予定', '削除対象', '削除検討', '削除検討中', '削除？', '削除?', '削除不要', '削除しない', '削除は保留', '削除保留', '削除取消', '削除→取消', '削除(取消)', '削除→保留', '削除（Rev.2）', '削除済', '削除（確認済）', '削除or変更', '削除/変更', '削除かも', '一部削除', '全削除', '削除 (仮)', '仮削除', '削除案', '削除候補', '削除予定なし', '削除なし', '削除無し', '削除せず', '廃止予定', '廃止検討', '廃止（保留）', '廃止しない', '取外し', '取外し予定', '取外し不要', '不要？', '不要かも', '要否確認', '要確認']
const out = []
for (const v of vals) {
  const t = T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
${v}｜タイマ｜H3CR-A8｜｜1
変更なし｜端子台｜XW2B-20G4｜｜4
追加｜ヒューズ｜｜F-5A｜3`)
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const st = (res) => (res.rows.some((x) => /H3CR|タイマ/.test(`${x.model}${x.name}`)) ? '残る' : '削除')
  out.push(`変更区分「${v}」 new=${st(r)} old=${st(o)}`)
}
fs.writeFileSync('results/q17_kindvals_hold.out', out.join('\n') + '\n')
console.log(out.join('\n'))
