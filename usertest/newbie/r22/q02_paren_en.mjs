// ラウンド22 q02: 括弧の中が英語・略語・複合の言い方
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const sheet = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
部品1｜P-10｜｜オムロン｜1｜${n}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const kind = (res) => { const l = res.rows.map(lab); return l.includes('P-10:1?') ? 'ASK' : l.includes('P-10:1') ? 'KEEP' : 'DEL' }
const K = ['pending', 'Pending', 'waiting for customer', 'TBD', 'tbd', 'on hold', 'hold', 'under review', 'review中', 'レビュー中', 'reviewing', 'to be confirmed', 'TBC', 'not yet', 'no', 'No', "don't", 'keep', 'Keep', 'NO DELETE', 'do not delete', 'not delete', 'cancel', 'cancelled', 'canceled', 'revisit', 'changing', 'on-going', 'ongoing', 'confirm', 'check', 'ask PM', 'ask customer', 'WIP', 'later', 'maybe', 'unknown', '?', '？', '??', 'ー', '-', '…', '※要確認', '※保留', '※客先確認', '(要確認)', '客先確認', '客先に確認', '客先へ確認', 'お客様確認中', 'お客様確認後', '客先OKなら', 'OKなら', '承認されたら', '決まれば', '決定次第', '回答次第', '客先次第', 'PM次第', '確認次第', '状況次第', '場合による', 'ケースバイケース', '案件による', '必要なら', '要るなら', '要る場合', '不要なら', 'いらなければ', 'なければ', '未使用なら', '使わなければ', '使用しなければ', '使用しない場合', '使用しない場合のみ', '使用しない場合は', '使わない場合', '不要の場合', '不要な場合', '不要なとき', '空きがあれば', 'スペースがあれば', '可能なら', 'できれば', 'できたら', '余裕があれば', '時間があれば', '変更しない', '変更しないこと', '変更不可', '変更なしの場合', '盤の確認待ち', '旧品番確認中', '旧版確認', '旧図面確認', 'ユニット確認中', 'ユニット確認待ち', '対象外かも', '対象かも', '対象確認', '対象を確認', '対象未定', '予定未定', '予定確認', '予定を確認', '予定変更の可能性']
const D = ['不要です', '不要になったため', '不要と確認済', '不要と判断', '不要と判断済', '客先承認済', 'PM承認済み', 'delete', 'deleted', 'DELETE', 'removed', 'remove', 'obsolete', 'EOL', 'NRND', 'discontinued', 'not used', 'unused', 'no longer used', 'not needed', 'unnecessary', 'done', 'OK', 'ok', 'Confirmed', 'confirmed', 'approved', 'Approved', 'ECN', 'by ECN', 'per ECN-12', 'replaced', 'replaced by P-20', 'superseded', 'merged', 'integrated', '〇', '○', '◯', '済', '済み', '✓', '✔', 'レ', '消', '消し', '消去', '消す', 'けす', 'さくじょ', '取る', '取り除く', 'はずす', '外す', '外します', '外した', '外しました', '無くす', 'なくす', 'なし', 'ナシ', '無し', '無', '廃', '廃止', '廃番', '不採用', '採用せず', '採用しない', '使用せず', '使用しません', '使用なし', '不使用', '未使用', 'いらない', '不用', '不用品', '不要部品', '要らなくなった', '必要なくなった', '必要ない', '必要なし', '不必要', '要不要=不要']
const out = []
const bad = { 'K→DEL': [], 'D→KEEP': [], 'K→ASK': 0, 'D→ASK': 0, ok: 0 }
for (const [meaning, list] of [['K', K], ['D', D]]) for (const w of list) for (const [a, b] of [['（', '）'], ['(', ')']]) {
  const n = `削除${a}${w}${b}`
  const o = kind(old.parseBomPaste(sheet(n))), r = kind(neu.parseBomPaste(sheet(n)))
  out.push(`${meaning} ${n} old=${o} new=${r}`)
  if (a !== '（') continue
  if (meaning === 'K' && r === 'DEL') bad['K→DEL'].push(`${n}(old=${o})`)
  else if (meaning === 'D' && r === 'KEEP') bad['D→KEEP'].push(`${n}(old=${o})`)
  else if (meaning === 'K' && r === 'ASK') bad['K→ASK']++
  else if (meaning === 'D' && r === 'ASK') bad['D→ASK']++
  else bad.ok++
}
console.log(JSON.stringify(bad, null, 1))
fs.writeFileSync('results/q02_paren_en.out', out.join('\n') + '\n\nSUMMARY ' + JSON.stringify(bad) + '\n')
