// ラウンド22 q04: ふつうの BOM（旧／新の列なし）で、矢印の型式（変換ケーブル・アダプタ）× 備考の言葉。備考に「位置」「交換」「追加」「修正」「銘板」「変更」…があると矢印の左が捨てられないか
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const models = ['USB-A→USB-C', 'DVI→HDMI', 'DB9->RJ45', 'XLR→TRS', '24VDC→12VDC', 'CAT5e→CAT6', 'RS-485→RS-232C', 'M12→M8', '3.5mm→6.3mm', 'AC100V→DC24V']
const notes = ['', '盤内位置: 右上', '取付位置は図面参照', '位置決めピン付', '予備', '交換用', '交換部品', '消耗品（定期交換）', '修正液', '追加購入品', '追加工あり', '銘板付', '銘板取付', '変更なし', '設計変更対応済', '客先変更あり', '仕様変更の可能性', '追記: 防水', '移設品', '差し替え不可', '差替え可', '長さ変更可', 'ケーブル長 2m（変更可）', '→ 右側に配線', '色: 赤→黒', 'Rev.B', '追加']
const bad = []
const out = []
for (const m of models) for (const n of notes) {
  const t = T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン｜4｜
変換ケーブル｜${m}｜サンワ｜1｜${n}
端子台｜XW2B-20G4｜オムロン｜4｜`)
  const o = old.parseBomPaste(t).rows.map(lab).join(' '), r = neu.parseBomPaste(t)
  const rr = r.rows.map(lab).join(' ')
  out.push(`${m} | ${n} => ${rr}${o !== rr ? '  (old: ' + o + ')' : ''}`)
  if (!rr.includes(m)) bad.push(`${m} | 備考「${n}」 => ${rr}   old=${o}`)
}
console.log('lost-left cases', bad.length, 'of', models.length * notes.length)
console.log(bad.slice(0, 40).join('\n'))
fs.writeFileSync('results/q04_arrow_ordinary.out', out.join('\n') + '\n\nLOST ' + bad.length + '\n' + bad.join('\n') + '\n')
