// ラウンド22 q13: 新の型式に「変えていない」つもりで書く言い方。結果が 旧の型式／削除／聞く／その文字が型式 のどれか
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const words = ['そのまま', 'そのまま使用', '変更なし', '変更無し', '変更ナシ', '同左', '同上', '〃', '-', '－', 'ー', '↓', '↓同上', 'ママ', 'N/A', 'n/a', 'NA', '不変', '現状通り', '現行通り', '現状維持', '旧のまま', '据置', '据え置き', '継続', '継続使用', '流用', '共通', '○', '〇', 'OK', 'ok', '済', '同', '変更しない', '変えない', '変更不要', '変更ありません', '変更はありません', 'No change', 'no change', 'NO CHANGE', 'Same', 'same', 'As is', 'unchanged', 'N.C.', 'NC', 'nc', '=', '＝', '＂', '"', '…', '...', '以下同', '以下同じ', '上に同じ', '上と同じ', '左に同じ', '(変更なし)', '※変更なし', '変更なし。', '変更なし（旧のまま）', '空', '(空)', '（空）', '無', 'なし', '無し', '0', '']
const out = []
let garbage = 0
for (const w of words) {
  const mk = (extra) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
端子台｜XW2B-20G4｜XW2B-20G4｜オムロン｜4
ソケット｜PYF14A｜PYF14A｜オムロン｜2
タイマ｜H3CR-A8｜${w}｜オムロン｜1${extra}`)
  for (const [label, text] of [['書き写し表', mk('')], ['変えた行だけ表', T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量
リレー｜MY2N｜MY4N-D2｜オムロン｜4
端子台｜XW2B-20G4｜｜オムロン｜4
ソケット｜PYF14A｜｜オムロン｜2
タイマ｜H3CR-A8｜${w}｜オムロン｜1`)]]) {
    const r = neu.parseBomPaste(text), o = old.parseBomPaste(text)
    const t = (res) => { const x = res.rows.find((q) => /タイマ/.test(q.name)); return x ? `${x.model}${(x.note ?? '').startsWith('【削除？】') ? '?' : ''}:${x.qtyNeeded}` : '(削除)' }
    const v = t(r)
    const kind = v === '(削除)' ? '削除' : /H3CR-A8:1$/.test(v) ? '旧のまま' : /\?/.test(v) ? '聞く' : '文字が型式: ' + v
    if (kind.startsWith('文字')) garbage++
    out.push(`${label} 新の型式「${w}」→ ${kind}  (old: ${t(o)})`)
  }
}
fs.writeFileSync('results/q13_samewords.out', out.join('\n') + `\ngarbage ${garbage}\n`)
console.log(out.filter((x) => /文字が型式/.test(x) && x.startsWith('変えた')).join('\n'))
console.log('garbage', garbage)
