// ラウンド22 q15: 1 つのセルに「旧→新」と書く変更図で、型式を新に直すのはどんな目印があるときか（見出し「型式（旧→新）」・変更区分の列・変更理由の列・表題・全行が矢印）
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
const run = (title, t) => {
  const r = neu.parseBomPaste(t), o = old.parseBomPaste(t)
  const a = r.rows.map(lab), b = o.rows.map(lab)
  const gotNew = a.some((x) => x.startsWith('MY4N-D2:')) && !a.some((x) => x.includes('→'))
  out.push(`[${title}] ${gotNew ? 'NEW側' : 'LEFT/ARROW残り'} ${JSON.stringify(a) !== JSON.stringify(b) ? '(old≠new) old=' + b.join(' ') : ''}\n   new: ${a.join(' ')} | ${r.warnings.join(' / ').slice(0, 120)}`)
  return gotNew
}
const hdrs = ['型式（旧→新）', '型式(旧→新)', '旧→新', '旧型式→新型式', '変更前→変更後', '型式（変更前→変更後）', '型式 旧→新', '型式（旧/新）', '型式', '型式（変更）', '変更後型式', '型式（改）']
for (const h of hdrs) run(`見出し「${h}」`, T(`品名｜${h}｜数量
リレー｜MY2N→MY4N-D2｜4
タイマ｜H3CR-A7→H3CR-A8｜1
端子台｜XW2B-20G4｜4`))
for (const [h, extra] of [['変更区分', ['変更', '変更', '']], ['変更内容', ['型式変更', '型式変更', '']], ['変更理由', ['廃番', '廃番', '']], ['備考', ['廃番のため変更', '廃番のため変更', '']], ['備考', ['', '', '']], ['変更区分', ['変更', '変更', '変更なし']], ['区分', ['変更', '変更', '']]]) run(`型式 1 列 + ${h}列(${extra.join('/')})`, T(`${h}｜品名｜型式｜数量
${extra[0]}｜リレー｜MY2N→MY4N-D2｜4
${extra[1]}｜タイマ｜H3CR-A7→H3CR-A8｜1
${extra[2]}｜端子台｜XW2B-20G4｜4`))
run('表題「設計変更表」+ 型式 1 列', T(`設計変更表 ECN-100
品名｜型式｜数量
リレー｜MY2N→MY4N-D2｜4
タイマ｜H3CR-A7→H3CR-A8｜1
端子台｜XW2B-20G4｜4`))
run('全行が矢印 + 備考なし', T(`品名｜型式｜数量
リレー｜MY2N→MY4N-D2｜4
タイマ｜H3CR-A7→H3CR-A8｜1
ランプ｜L-1→L-2｜2`))
run('数量の矢印（2→4）', T(`品名｜型式｜数量
リレー｜MY4N-D2｜2→4
タイマ｜H3CR-A8｜1`))
run('メーカーの矢印', T(`品名｜型式｜メーカー｜数量｜備考
リレー｜MY4N-D2｜オムロン→IDEC｜4｜メーカ変更
タイマ｜H3CR-A8｜オムロン｜1｜`))
fs.writeFileSync('results/q15_arrow_markers.out', out.join('\n') + '\n')
console.log(out.join('\n'))
