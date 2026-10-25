// ラウンド22 q01: 「削除（…）」の括弧の中の言葉を、新人が書く言い方で 130 通り。意味（K=残す／D=削除／?=どちらでも）と実際（DEL=黙って削除／KEEP=黙って残す／ASK=【削除？】）を比べる
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const K = ['保留', '保留中', '検討中', '未定', '後日', '後日決定', '客先確認中', '客先回答待ち', '回答待ち', '返事待ち', '確認待ち', '承認待ち', 'PM確認待ち', '顧客確認後', '確認後', '要確認', '未確認', '確認中', '要検討', '仮', '仮削除', '案', '案1', '候補', '予定', '計画なし', 'まだしない', 'まだ', '今回は見送り', '今回はなし', '今回は対象外', '次回', '次期', '次回以降', '将来', '将来的に', '検討', '協議中', '調整中', '相談中', '判断待ち', '未実施', '実施せず', '取り止め', '取りやめ', '戻し', '戻す', '復活', '元に戻す', '無効', '客先確認要', '設計確認要', 'PMに確認', '購買に確認', '要PM確認', '見直し中', '再検討', '再確認', '確認してから', '確認できたら', '決まったら', '決定後', '未承認', '承認前', '承認まだ', '未決', '未了', '未対応', '対応待ち', '対応中', '作業中', '準備中', '一時保留', '保留とする', '削除しない予定', '残す', '残します', '使う', '使用する', '使用中', '継続使用', '継続', '流用', '再使用', '再利用', '再取付け', '再取り付け', '付け直し', '付け替え', '移設']
const D = ['確認済', '確認済み', '生産中止', '廃番', '不要品', '使用しないため', '不要のため', '客先指定により', '仕様変更により', '設計変更', '変更により', 'コスト削減', '他部品で代替', '統合', '共通化', '集約', '置換', 'R012へ', 'Rev.B', '完了', '実施済', '対応済', '承認済', '客先承認済', 'PM承認済', '旧品', '旧型', '旧仕様', '旧機種', '不要になった', 'いらなくなった', '使わない', '使用不可', 'EOL', '製造終了', 'ディスコン', '代替品あり', '代替あり', '代わりにXXを使用', 'XXに変更', '不要になったため', '使わなくなった', '要らない', 'いらない', '不要です', '不要', '客先指示', '客先要望', '客先要求', '顧客要望', '顧客指示', '指示により', 'ECN-1234', 'ECN1234', 'ECN', '設変', '設変により', '設計判断', '共通部品に統合', '別ユニットへ移動', '他盤へ移設', 'ユニットごと', '盤ごと', '全部', '全数', '全て', 'すべて', '全削除', 'Rev.2', 'RevB', 'B版', 'B版で', '2版', 'R2', '次版', '次Rev']
const rows = []
const heads = ['削除', '撤去', '取外し', '廃止']
const wrap = [['（', '）'], ['(', ')'], ['【', '】'], ['→', '']]
const sheet = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
部品1｜P-10｜｜オムロン｜1｜${n}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const kind = (res) => { const l = res.rows.map(lab); const has = l.some((x) => x === 'P-10:1'); const ask = l.some((x) => x === 'P-10:1?'); return ask ? 'ASK' : has ? 'KEEP' : 'DEL' }
const out = []
const bad = { 'K→DEL': [], 'D→KEEP': [], 'K→ASK': 0, 'D→ASK': 0, ok: 0 }
for (const [meaning, list] of [['K', K], ['D', D]]) for (const w of list) for (const h of ['削除']) for (const [a, b] of wrap.slice(0, 2)) {
  const n = `${h}${a}${w}${b}`
  const t = sheet(n)
  const o = kind(old.parseBomPaste(t)), r = kind(neu.parseBomPaste(t))
  out.push(`${meaning} ${n} old=${o} new=${r}`)
  if (a === '（') {
    if (meaning === 'K' && r === 'DEL') bad['K→DEL'].push(`${n}(old=${o})`)
    else if (meaning === 'D' && r === 'KEEP') bad['D→KEEP'].push(`${n}(old=${o})`)
    else if (meaning === 'K' && r === 'ASK') bad['K→ASK']++
    else if (meaning === 'D' && r === 'ASK') bad['D→ASK']++
    else bad.ok++
  }
}
// 他の頭の語（撤去・取外し・廃止）は全角括弧のみ
for (const h of ['撤去', '取外し', '廃止']) for (const [meaning, list] of [['K', K], ['D', D]]) for (const w of list) {
  const n = `${h}（${w}）`
  const o = kind(old.parseBomPaste(sheet(n))), r = kind(neu.parseBomPaste(sheet(n)))
  out.push(`${meaning} ${n} old=${o} new=${r}`)
  if (meaning === 'K' && r === 'DEL') bad['K→DEL'].push(`${n}(old=${o})`)
  else if (meaning === 'D' && r === 'KEEP') bad['D→KEEP'].push(`${n}(old=${o})`)
}
// 矢印
for (const [meaning, list] of [['K', K], ['D', D]]) for (const w of list) {
  const n = `削除→${w}`
  const o = kind(old.parseBomPaste(sheet(n))), r = kind(neu.parseBomPaste(sheet(n)))
  out.push(`${meaning} ${n} old=${o} new=${r}`)
  if (meaning === 'K' && r === 'DEL') bad['K→DEL'].push(`${n}(old=${o})`)
  else if (meaning === 'D' && r === 'KEEP') bad['D→KEEP'].push(`${n}(old=${o})`)
}
console.log(JSON.stringify({ ...bad, 'K→DEL_n': bad['K→DEL'].length, 'D→KEEP_n': bad['D→KEEP'].length }, null, 1))
fs.writeFileSync('results/q01_paren_matrix.out', out.join('\n') + '\n\nSUMMARY ' + JSON.stringify(bad) + '\n')
