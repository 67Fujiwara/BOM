// ラウンド23 n05: DNP の備考の言い方。実装しない部品として外れる（X）／外れず残る（K）。K でなければならないもの（メーカ名・手配・品）と X でなければならないもの
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const notes = [
  // 外れてよい／外れるべき
  ['X', 'DNP'], ['X', 'dnp'], ['X', 'DNP 将来用'], ['X', 'DNP将来用'], ['X', 'DNP:将来用'], ['X', 'DNP：将来用'], ['X', 'DNP/未実装'], ['X', 'DNP・未実装'], ['X', 'DNP 未実装'], ['X', 'DNP 未'], ['X', 'DNP オプション'], ['X', 'DNP(オプション)'], ['X', 'DNP（将来）'], ['X', 'DNP 不要'], ['X', 'DNP実装しない'], ['X', 'DNP 実装なし'], ['X', 'DNP 実装不要'], ['X', 'DNP、将来用'], ['X', 'DNP, 将来用'], ['X', 'DNP 非実装'], ['X', 'DNP 省略'], ['X', 'DNP 外す'], ['X', 'DNP option'], ['X', 'DNP future'], ['X', 'DNP NC'], ['X', 'DNP not fitted'],
  ['X', '(未実装)'], ['X', '※未実装'], ['X', '【未実装】'], ['X', '未実装'], ['X', '未実装品'], ['X', '実装しません'], ['X', '実装しない'], ['X', '実装なし'], ['X', 'Not Fitted'], ['X', 'Do not place'], ['X', '※DNP'], ['X', '(DNP)'], ['X', '【DNP】'], ['X', '＊DNP'], ['X', '将来用 DNP'],
  // 残るべき（メーカ名・手配・品・説明）
  ['K', 'DNP製'], ['K', 'DNP/AGC'], ['K', 'DNP（大日本印刷）'], ['K', 'DNP(大日本印刷)'], ['K', 'DNP 手配'], ['K', 'DNP手配'], ['K', 'DNP品'], ['K', 'DNP 品'], ['K', 'DNP部品'], ['K', 'DNP対象'], ['K', 'DNP社'], ['K', 'DNP 社製'], ['K', 'DNPフォトマスク'], ['K', 'DNP印刷'], ['K', '大日本印刷(DNP)'], ['K', 'メーカ:DNP'], ['K', '仕入先 DNP'], ['K', 'DNPに手配'], ['K', 'DNP経由'], ['K', 'DNP納期確認'], ['K', 'DNP未納'], ['K', 'DNP未着'], ['K', 'DNP未入荷'], ['K', 'DNP不良品'], ['K', 'DNP不足'], ['K', 'DNP実績あり'], ['K', 'DNP実績'], ['K', 'DNP実機'], ['K', 'DNPオプション品を購入'], ['K', 'DNP未手配'],
  ['K', 'FPC DNP製'], ['K', '実装済'], ['K', '実装位置 A3'], ['K', '実装方向注意'], ['K', '未実装部品の隣'], ['K', 'ダミー'], ['K', '将来用'], ['K', '予備'], ['K', 'オプション'], ['K', '不要な場合は削除'],
]
const sheetNote = (n) => T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\nコネクタ｜FH12-10S｜ヒロセ｜2｜${n}\n端子台｜XW2B-20G4｜オムロン｜4｜`)
const sheetMaker = (n) => T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\nコネクタ｜FH12-10S｜${n}｜2｜\n端子台｜XW2B-20G4｜オムロン｜4｜`)
const sheetUnmapped = (n) => T(`品名｜型式｜メーカー｜数量｜実装位置\nリレー｜MY4N-D2｜オムロン｜4｜A1\nコネクタ｜FH12-10S｜ヒロセ｜2｜${n}\n端子台｜XW2B-20G4｜オムロン｜4｜A2`)
const sheetName = (n) => T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\n${n}｜FH12-10S｜ヒロセ｜2｜\n端子台｜XW2B-20G4｜オムロン｜4｜`)
const has = (res, w) => res.rows.some((r) => r.model === 'FH12-10S' || r.name === w)
const out = []
const bad = { 'note K→外れた': [], 'note X→残った': [], 'unmapped K→外れた': [], 'maker K→外れた': [], 'name K→外れた': [] }
for (const [m, n] of notes) {
  const rn = has(neu.parseBomPaste(sheetNote(n))), ro = has(old.parseBomPaste(sheetNote(n)))
  const ru = has(neu.parseBomPaste(sheetUnmapped(n))), rm = has(neu.parseBomPaste(sheetMaker(n)))
  out.push(`${m} 「${n}」 note: old=${ro ? '残' : '外'} new=${rn ? '残' : '外'} / 未割当列: ${ru ? '残' : '外'} / メーカ列: ${rm ? '残' : '外'}`)
  if (m === 'K' && !rn) bad['note K→外れた'].push(`${n}(old=${ro ? '残' : '外'})`)
  if (m === 'X' && rn) bad['note X→残った'].push(`${n}(old=${ro ? '残' : '外'})`)
  if (m === 'K' && !ru) bad['unmapped K→外れた'].push(n)
  if (m === 'K' && !rm) bad['maker K→外れた'].push(n)
}
// 部品名・型式・メーカー列に DNP
for (const [lbl, mk] of [['品名にDNP', (n) => T(`品名｜型式｜メーカー｜数量\nリレー｜MY4N-D2｜オムロン｜4\n${n}｜FH12-10S｜ヒロセ｜2\n端子台｜XW2B-20G4｜オムロン｜4`)], ['型式にDNP', (n) => T(`品名｜型式｜メーカー｜数量\nリレー｜MY4N-D2｜オムロン｜4\nコネクタ｜${n}｜ヒロセ｜2\n端子台｜XW2B-20G4｜オムロン｜4`)]])
  for (const n of ['DNP', 'DNP（大日本印刷）', 'DNP製', 'DNP 将来用', 'DNP-100', 'DNP_BOX']) { const r = neu.parseBomPaste(mk(n)); out.push(`${lbl} 「${n}」 → ${r.rows.length}行`) }
fs.writeFileSync('results/n05_dnp.out', out.join('\n') + '\n\nBAD\n' + Object.entries(bad).map(([k, v]) => `${k} (${v.length}): ${v.join(' / ')}`).join('\n') + '\n')
for (const [k, v] of Object.entries(bad)) console.log(k, v.length, v.join(' / '))
