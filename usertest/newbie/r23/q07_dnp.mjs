// ラウンド22 q07: DNP・未実装の判定を列ごとに（備考／使わない列／部品名／型式／メーカ／実装の列）。外れたら X
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
const dropped = (t, label) => { const r = neu.parseBomPaste(t), o = old.parseBomPaste(t); const keep = r.rows.some((x) => lab(x).startsWith(label)); const okeep = o.rows.some((x) => lab(x).startsWith(label)); return [keep ? 'KEEP' : 'DROP', okeep ? 'KEEP' : 'DROP'] }
const tbl = (cols, row) => T(`${cols.join('｜')}\nリレー｜MY4N-D2｜オムロン｜4｜${cols.length > 4 ? '｜'.repeat(0) : ''}\n${row.join('｜')}`)
const res = []
// 備考の列に DNP の言い回し（本物の備考 = 残すべき、実装しない = 外すべき）
const noteKeep = ['DNP製', 'DNP社製', 'DNP 製', 'DNP 社製', 'DNP 反射防止フィルム', 'DNP製 反射防止フィルム', 'DNP指定', 'DNP 指定品', 'DNP品番 ABC-1', 'DNP 品番: ABC-1', 'DNP（大日本印刷）', 'DNP(大日本印刷)製', 'DNPフォトマスク', 'DNP/オムロン共通', 'DNP/AGC', 'DNP:大日本印刷', 'DNP: 大日本印刷製', 'DNP・AGC', 'DNP品あり', 'DNP品を使用', 'DNP品でお願いします', 'DNPの製品', 'DNPにて購入', 'DNP納入', 'DNP 納入品', 'DNP経由', 'DNP社より支給', 'DNP 支給']
const noteDrop = ['DNP', 'dnp', 'DNP 将来用', 'DNP将来用', 'DNP、将来用', 'DNP:将来用', 'DNP/未実装', 'DNP品', 'DNP部品', 'DNP対象', 'DNP（実装しない）', 'DNP（将来用）', 'Do Not Populate', 'DO NOT PLACE', 'Not Fitted', 'NF', 'NP', 'N/P', 'NC', 'non-pop', '未実装', '未実装品', '実装しない', '実装なし', '実装不要', '実装しません', '実装無し', '実装せず', '非実装', '非実装品', 'オプション（未実装）', '将来用（未実装）', '標準では未実装', '※未実装', '(未実装)', '【未実装】', 'DNP※', 'DNP 予備', 'DNP(予備)']
for (const [lbl, list, want] of [['備考', noteKeep, 'KEEP'], ['備考', noteDrop, 'DROP']]) for (const n of list) {
  const t = T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜${n}`)
  const [a, b] = dropped(t, 'H3CR')
  res.push([`備考「${n}」`, want, a, b])
}
// 使わない列（見出しが未知）にDNP
for (const n of ['DNP', 'DNP 製', 'DNP 将来用', 'DNP（大日本印刷）', 'DNP品', 'DNP/未実装', 'DNP納入']) {
  const t = T(`品名｜型式｜メーカー｜数量｜規格\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜${n}`)
  const [a, b] = dropped(t, 'H3CR')
  res.push([`規格(未知の列)「${n}」`, /製|大日本|納入/.test(n) ? 'KEEP' : 'DROP', a, b])
}
// 部品名・型式・メーカ
for (const [col, vals] of [['品名', ['DNP', 'DNP（大日本印刷）', 'DNP 反射フィルム', 'DNP製フィルム', '未実装', '未実装基板', 'DNP品', 'Not Fitted']], ['型式', ['DNP', 'DNP-100', 'DNP 100', 'DNP/AGC', 'DNP（予備）', '未実装', 'DNP品']], ['メーカー', ['DNP', 'DNP（大日本印刷）', '大日本印刷', 'DNP社', 'DNP 社']]]) for (const v of vals) {
  const cols = ['品名', '型式', 'メーカー', '数量']
  const row = ['タイマ', 'H3CR-A8', 'オムロン', '1']; row[cols.indexOf(col)] = v
  const t = T(`${cols.join('｜')}\nリレー｜MY4N-D2｜オムロン｜4\n${row.join('｜')}`)
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  res.push([`${col}列「${v}」`, '(参考)', r.rows.length === 2 ? 'KEEP' : 'DROP', o.rows.length === 2 ? 'KEEP' : 'DROP'])
}
// 実装の列（DNP/実装/Fitted）
for (const [h, vals] of [['DNP', ['x', 'X', '1', 'yes', 'Y', 'DNP', '○', '●', '✓', '未実装', 'しない', 'true', '', '0', 'no', '-', '×']], ['実装', ['×', '未', 'なし', '無', '不要', '○', '有', 'あり', '手', '自動', '-', '0', '1', '未実装', 'しない', 'NO']], ['Fitted', ['No', 'N', 'NF', 'Not Fitted', '×', '0', 'false', 'Yes', '1', 'Y', '○', '-']], ['実装有無', ['無', '有', '×', '○', '未実装']], ['Populate', ['no', 'NO', 'yes', '0', '1', 'DNP']], ['DNP区分', ['DNP', '', '実装']]]) for (const v of vals) {
  const t = T(`品名｜型式｜メーカー｜数量｜${h}\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜${v}`)
  const [a, b] = dropped(t, 'H3CR')
  res.push([`列「${h}」=「${v}」`, '(参考)', a, b])
}
const diffs = res.filter(([, w, a, b]) => (w !== '(参考)' && w !== a) || a !== b)
fs.writeFileSync('results/q07_dnp.out', res.map((r) => r.join(' | ')).join('\n') + '\n')
console.log(diffs.map((r) => r.join(' | ')).join('\n'))
