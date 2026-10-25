// ラウンド22 q10: 新の列（型式（新）・数量（新）・メーカ（新））に書いた削除の言い方。残す／削除／聞く
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
const vals = ['削除', '→削除', '削除済', '削除（Rev.2）', '削除(保留)', '削除（保留）', '削除（しない）', '削除（要確認）', '撤去（再取付）', '撤去(再利用)', '削除（客先回答待ち）', '削除（pending）', '削除に変更', '削除対象', '削除予定', '削除不要', '削除しない', '削除はしない', '削除取消', '削除は保留', '削除保留', '削除検討中', '削除？', '削除?', '削除かも', '削除してよいか確認', '一部削除', '全削除', '廃止予定', '廃止しない', '廃止（保留）', '取外し', '取外し不可', '取り外し可能', '撤去スペース確保', '削除スペース', '不要', '不要？', '不要か確認', '不要かも', '未定', 'TBD', '保留', '要確認', '検討中', '?', '？', '－', '同上', '〃', 'そのまま', 'No change', '変更なし', '(変更なし)', '変更不要', '空欄']
for (const col of ['型式', '数量', 'メーカ']) for (const v of vals) {
  const hdr = col === '型式' ? '品名｜型式（旧）｜型式（新）｜メーカー｜数量' : col === '数量' ? '品名｜型式｜メーカー｜数量（旧）｜数量（新）' : '品名｜型式｜メーカー（旧）｜メーカー（新）｜数量'
  const rows = col === '型式' ? `リレー｜MY2N｜MY4N-D2｜オムロン｜4\nタイマ｜H3CR-A8｜${v === '空欄' ? '' : v}｜オムロン｜1\n端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4\nソケット｜PYF14A｜PYF14A｜オムロン｜2` : col === '数量' ? `リレー｜MY4N-D2｜オムロン｜4｜6\nタイマ｜H3CR-A8｜オムロン｜1｜${v === '空欄' ? '' : v}\n端子台｜XW2B-20G4｜オムロン｜4｜4\nソケット｜PYF14A｜オムロン｜2｜2` : `リレー｜MY4N-D2｜オムロン｜オムロン｜4\nタイマ｜H3CR-A8｜オムロン｜${v === '空欄' ? '' : v}｜1\n端子台｜XW2B-20G4｜オムロン｜オムロン｜4\nソケット｜PYF14A｜オムロン｜オムロン｜2`
  const t = T(`${hdr}\n${rows}`)
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const find = (res) => { const x = res.rows.find((q) => /H3CR|タイマ/.test(`${q.model}${q.name}`)); return x ? `${x.model}|${x.maker}|${x.qtyNeeded}${(x.note ?? '').startsWith('【削除？】') ? '?' : ''}` : '(削除)' }
  out.push(`${col} 「${v}」 new=${find(r)} old=${find(o)}`)
}
fs.writeFileSync('results/q10_newmodel.out', out.join('\n') + '\n')
console.log(out.filter((x) => x.startsWith('型式')).join('\n'))
