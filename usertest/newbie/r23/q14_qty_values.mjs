// ラウンド22 q14: 数量セルの新人の書き方
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers()
const vals = ['4', '４', '4個', '4ヶ', '4ケ', '4コ', '4pcs', '4 pcs', '4PCS', '4pc', 'x4', 'X4', '×4', '*4', '4x', '4×', '約4', '4以上', '4〜6', '4~6', '4-6', '4,000', '1,000', '1.5', '1.5m', '0.5', '1式', '1 式', '一式', '1セット', '1set', '2set', '4台', '4台分', '4枚', '4本', '4m', '4M', '4ｍ', '4mm', '4 m', '-', '－', 'ー', '', ' ', '0', '00', '０', '4.', '.5', '4a', 'a4', '4/6', '1/2', '2+1', '2＋1', '2(予備1)', '2（予備1）', '予備', '要確認', '未定', 'TBD', '適宜', '必要数', '4*2', '4×2', '=2*2', '#REF!', '#N/A', '#VALUE!', 'N/A', '数式', '4 ', '　4', '4箱', '4袋', '4パック', '4pack']
const out = []
for (const v of vals) {
  const t = T(`品名｜型式｜メーカー｜数量\nリレー｜MY4N-D2｜オムロン｜4\nタイマ｜H3CR-A8｜オムロン｜${v}`)
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const x = r.rows[1], y = o.rows[1]
  out.push(`「${v}」 => qty=${x?.qtyNeeded} unit=${x?.unit} note=${x?.note ?? ''} ${JSON.stringify(x) !== JSON.stringify(y) ? '| old qty=' + y?.qtyNeeded : ''} | ${r.warnings.filter((w) => /数量|単位/.test(w)).join('/').slice(0, 60)}`)
}
fs.writeFileSync('results/q14_qty_values.out', out.join('\n') + '\n')
console.log(out.join('\n'))
