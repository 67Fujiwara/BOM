// o2d: 承認 ON。3 本の連鎖：Rev.3＝N 追加＋D 必要数、Rev.4＝N の部品名＋M 必要数（N は Rev.4 にまとめ）、Rev.5＝N の部品名（N は Rev.5 にまとめ）
//   usage: node o2d.mjs A3,A4,A5   （D＝Rev.3・M＝Rev.4・N＝Rev.5 の行で、左から順に承認 A／却下 R）
//   期待: N は Rev.5 の決定だけで決まる（A5＝公開・部品名 N3、R5＝下書き。Rev.3・4 の承認／却下に関係なく）。D は Rev.3、M は Rev.4 の決定だけ。承認待ちが残らない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
const order = (process.argv[2] ?? 'A3,A4,A5').split(',')
const tag = order.join('')
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const D = sel[1].id, qD = sel[1].qtyNeeded, M = sel[2].id, qM = sel[2].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
log('N', N, 'D', D, 'M', M)
await t.setCellKey(D, 'qtyNeeded', String(qD + 1)); log('publish Rev.3 →', (await t.publish('1')).slice(-30))
await t.setCellKey(N, 'name', '追加行N2'); await t.setCellKey(M, 'qtyNeeded', String(qM + 1)); log('publish Rev.4 →', (await t.publish('3')).slice(-30))
await t.setCellKey(N, 'name', '追加行N3'); log('publish Rev.5 →', (await t.publish('6')).slice(-30))
let p = await t.proj(); log('subs', c.subs(p)); checkInv(`O2D-${tag}-0`, p)
const revs = p.submissions.filter((s) => s.changeSet).map((s) => s.rev).slice(-3); const [r3, r4, r5] = revs
check(`O2D-${tag}-1 前提：N は Rev.${r5} の承認待ち、D は Rev.${r3}、M は Rev.${r4}`, rowOf(p, N).pendingRev === r5 && rowOf(p, D).pendingRev === r3 && rowOf(p, M).pendingRev === r4, `N=${rowOf(p, N).pendingRev} D=${rowOf(p, D).pendingRev} M=${rowOf(p, M).pendingRev}`)
const idOf = { 3: D, 4: M, 5: N }
for (const tok of order) {
  const id = idOf[tok[1]]; await t.role('pm'); await t.press('7')
  const r = tok[0] === 'A' ? await t.yes(id, tok) : await t.decide(id, 'Shift+Y', tok)
  p = await t.proj(); log('PM', tok, id, '→', r.toast.slice(0, 70), '|', 'N', rowOf(p, N).status, 'pend', rowOf(p, N).pendingRev); checkInv(`O2D-${tag}-after-${tok}`, p)
}
p = await t.proj(); const rN = rowOf(p, N), rD = rowOf(p, D), rM = rowOf(p, M)
const dec = Object.fromEntries(order.map((x) => [x[1], x[0]]))
log('final subs', c.subs(p)); log('N', h.show(p, N).slice(0, 140), 'name', rN.name, '| D q', rD.qtyNeeded, JSON.stringify(rD.working ?? null), '| M q', rM.qtyNeeded, JSON.stringify(rM.working ?? null))
if (dec[5] === 'A') check(`O2D-${tag}-2 Rev.5 承認で N は公開（部品名 追加行N3、承認待ちなし）`, rN.status === 'submitted' && !rN.flags.pmPending && rN.name === '追加行N3', h.show(p, N).slice(0, 120) + ' ' + rN.name)
else check(`O2D-${tag}-2 Rev.5 却下で N は下書き（removal・公開の印なし）`, rN.status === 'draft' && !rN.removal && rN.publishedRev == null && !rN.flags.pmPending, `${rN.status} pub=${rN.publishedRev} removal=${JSON.stringify(rN.removal)}`)
check(`O2D-${tag}-3 D は Rev.${r3} の決定（${dec[3]}）だけ`, dec[3] === 'A' ? rD.qtyNeeded === qD + 1 : rD.qtyNeeded === qD && rD.working?.qtyNeeded === qD + 1, `D q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
check(`O2D-${tag}-4 M は Rev.${r4} の決定（${dec[4]}）だけ`, dec[4] === 'A' ? rM.qtyNeeded === qM + 1 : rM.qtyNeeded === qM && rM.working?.qtyNeeded === qM + 1, `M q=${rM.qtyNeeded} w=${JSON.stringify(rM.working ?? null)}`)
check(`O2D-${tag}-5 承認待ちの変更セットが残らない`, !p.submissions.some((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null), c.subs(p))
await t.role('purchasing'); const in9 = await h.inView('purchasing', 9, N)
check(`O2D-${tag}-6 購買の 9 に N が出るのは Rev.5 を承認したときだけ`, in9 === (dec[5] === 'A'), `in9=${in9}`)
const ex = await c.excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === N && r[0] !== '').map((r) => [r[0], String(r[7] ?? '').slice(0, 24), String(r[8] ?? '')])
log('purchasing 変更点 N', JSON.stringify(chg))
if (dec[5] === 'R') check(`O2D-${tag}-7 却下で下書きに戻った N が購買の変更点に出ない`, chg.length === 0, JSON.stringify(chg))
else check(`O2D-${tag}-7 承認した N は購買の変更点に出て、最終の部品名（追加行N3）が内容にある`, chg.some((x) => /追加行N3/.test(x[1])), JSON.stringify(chg))
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
