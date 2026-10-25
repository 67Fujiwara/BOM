// ラウンド22 q08: 変更区分の列の値が「語彙の仲間ばかり」でないと列ごと無視される（Add/Change/Remove・New/Modify/Delete・新規/変更/削除/継続・注記つき）
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
const sets = [
  ['日本語 追加/変更/削除', ['変更', '削除', '追加', '変更なし']],
  ['日本語 新規/変更/廃止/継続', ['変更', '廃止', '新規', '継続']],
  ['日本語 新規/流用/削除', ['新規', '流用', '削除', '流用']],
  ['日本語 追加/変更/削除/変更無', ['変更', '削除', '追加', '変更無']],
  ['日本語 変更あり/削除', ['変更あり', '削除', '追加', '変更なし']],
  ['日本語 追加/変更/削除 + 備考的', ['変更', '削除', '追加', '据置']],
  ['日本語 変更/削除/追加/据え置き', ['変更', '削除', '追加', '据え置き']],
  ['日本語 変更/削除/追加/無し', ['変更', '削除', '追加', '無し']],
  ['日本語 変更/削除/追加/なし', ['変更', '削除', '追加', 'なし']],
  ['日本語 変更/削除/追加/-', ['変更', '削除', '追加', '-']],
  ['日本語 変更/削除/追加/○', ['変更', '削除', '追加', '○']],
  ['日本語 変更/削除/追加/継続使用', ['変更', '削除', '追加', '継続使用']],
  ['日本語 変更/削除/追加/共通', ['変更', '削除', '追加', '共通']],
  ['日本語 変更/削除/追加/現状', ['変更', '削除', '追加', '現状']],
  ['日本語 変更/削除/追加/そのまま', ['変更', '削除', '追加', 'そのまま']],
  ['日本語 変更/削除/追加/変更なし', ['変更', '削除', '追加', '変更なし']],
  ['日本語 変更/削除/追加/変更前のまま', ['変更', '削除', '追加', '変更前のまま']],
  ['日本語 変更/削除/追加/残', ['変更', '削除', '追加', '残']],
  ['日本語 変更/削除/追加/残す', ['変更', '削除', '追加', '残す']],
  ['日本語 変更/削除/追加/維持', ['変更', '削除', '追加', '維持']],
  ['日本語 変更/削除/追加/保持', ['変更', '削除', '追加', '保持']],
  ['English Add/Change/Remove/No change', ['Change', 'Remove', 'Add', 'No change']],
  ['English Added/Changed/Deleted/Unchanged', ['Changed', 'Deleted', 'Added', 'Unchanged']],
  ['English New/Modify/Delete/Same', ['Modify', 'Delete', 'New', 'Same']],
  ['English ADD/CHG/DEL/-', ['CHG', 'DEL', 'ADD', '-']],
  ['English A/C/D', ['C', 'D', 'A', '']],
  ['English Add/Delete only', ['Add', 'Delete', 'Add', '']],
  ['English Modified/Removed/Keep', ['Modified', 'Removed', 'Added', 'Keep']],
  ['English Replace/Remove/Add', ['Replace', 'Remove', 'Add', '']],
  ['English Update/Delete/Insert', ['Update', 'Delete', 'Insert', '']],
  ['記号 ▲/×/＋/－', ['▲', '×', '＋', '－']],
  ['記号 ○/×', ['○', '×', '○', '○']],
  ['記号 変/削/追', ['変', '削', '追', '']],
  ['記号 変更/削除/追加/空', ['変更', '削除', '追加', '']],
  ['番号 1/2/3', ['1', '3', '2', '']],
  ['日本語 置換/削除/追加', ['置換', '削除', '追加', '']],
  ['日本語 交換/削除/新設', ['交換', '削除', '新設', '']],
  ['日本語 差替/削除/増', ['差替', '削除', '増', '']],
  ['日本語 変更/撤去/追加', ['変更', '撤去', '追加', '']],
  ['日本語 修正/削除/新規', ['修正', '削除', '新規', '']],
  ['日本語 型式変更/削除/追加', ['型式変更', '削除', '追加', '']],
  ['日本語 数量変更/削除/追加', ['数量変更', '削除', '追加', '']],
  ['日本語 メーカ変更/削除/追加', ['メーカ変更', '削除', '追加', '']],
  ['日本語 変更(型式)/削除/追加', ['変更(型式)', '削除', '追加', '']],
  ['日本語 変更・削除・追加 の注記', ['変更（型式）', '削除（Rev.B）', '追加（新規）', '']],
]
let n = 0, miss = 0
for (const hdr of ['変更区分', 'Change Type', '変更タイプ', 'Action']) for (const [title, v] of sets) {
  const t = T(`${hdr}｜品名｜型式（旧）｜型式（新）｜数量
${v[0]}｜リレー｜MY2N｜MY4N-D2｜4
${v[1]}｜タイマ｜H3CR-A8｜｜1
${v[2]}｜端子台｜｜XW2B-20G4｜4
${v[3]}｜ヒューズ｜F-5A｜｜3`)
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const a = r.rows.map(lab), b = o.rows.map(lab)
  const timerGone = !a.some((x) => x.startsWith('H3CR'))
  n++
  if (!timerGone) miss++
  out.push(`${hdr} | ${title} | タイマ(削除) ${timerGone ? 'GONE' : 'STAYS'} | new: ${a.join(' ')}${JSON.stringify(a) !== JSON.stringify(b) ? ' | old: ' + b.join(' ') : ''}`)
}
fs.writeFileSync('results/q08_kind_vocab.out', out.join('\n') + `\nstays ${miss}/${n}\n`)
console.log(out.filter((x) => x.includes('STAYS') && x.startsWith('変更区分')).join('\n'))
console.log('stays', miss, '/', n)
