// o2c: 承認 ON。追加行 N を Rev.c（N 追加＋D 必要数）で出し、Rev.d で N を取消（cancel）／置換（repl）したあと、承認・却下の全順序を試す
//   usage: node o2c.mjs cancel|repl A3,A4
//   期待: Rev.d 承認 → cancel: N は取消（または下書きの削除）・購買に出ない／repl: N は置換済・N2 が公開。Rev.d 却下 → N は下書き（removal なし・N2 は下書きか無い）。
//         Rev.c 承認／却下は D だけに効く。承認待ちが残らない。購買の 9・概算見積・変更点に、承認されていない N・N2 が出ない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
const kind = process.argv[2] ?? 'cancel'
const order = (process.argv[3] ?? 'A3,A4').split(',')
const tag = kind + '-' + order.join('')
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const D = sel[1].id, qD = sel[1].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', (await t.publish('1')).slice(0, 70))
const rev = async () => (await t.proj()).submissions.at(-1).rev
const revC = await rev(); let N2 = null
if (kind === 'cancel') { await t.goto(N); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) } }
else { log('N replace →', await t.replace(N, 'G3VM-61A9')); const pp = await t.proj(); N2 = pp.rows.find((r) => r.replaces === N)?.id; log('N2', N2) }
log('publish Rev.d →', (await t.publish('3')).slice(0, 70)); const revD = await rev(); let p = await t.proj()
log('subs', c.subs(p), '| N', h.show(p, N).slice(0, 120), N2 ? '| N2 ' + h.show(p, N2).slice(0, 120) : '')
checkInv(`O2C-${tag}-0`, p)
async function pmDo(tok) {
  const rv = tok[1]; const id = rv === '3' ? D : N
  await t.role('pm'); await t.press('7')
  const r = tok[0] === 'A' ? await t.yes(id, `Rev.${rv} ${tok}`) : await t.decide(id, 'Shift+Y', `Rev.${rv} ${tok}`)
  p = await t.proj(); log('PM', tok, id, '→', r.toast.slice(0, 80), '|', c.subs(p).slice(0, 220), '| N', rowOf(p, N).status, N2 ? 'N2 ' + (rowOf(p, N2)?.status ?? '(なし)') : ''); checkInv(`O2C-${tag}-after-${tok}`, p)
}
for (const tok of order) await pmDo(tok)
p = await t.proj(); const rN = rowOf(p, N), rN2 = N2 ? rowOf(p, N2) : null, rD = rowOf(p, D)
const dec4 = order.find((x) => x[1] === '4'), dec3 = order.find((x) => x[1] === '3')
log('final N', h.show(p, N).slice(0, 150), '| removal', JSON.stringify(rN.removal ?? null), '| N2', rN2 ? h.show(p, N2).slice(0, 150) : '-')
if (dec4 === 'R4') {
  check(`O2C-${tag}-1 Rev.d 却下で N は下書き（removal・承認待ちなし）`, rN.status === 'draft' && !rN.removal && !rN.pendingRemoval && !rN.flags.pmPending && rN.publishedRev == null, `${rN.status} removal=${JSON.stringify(rN.removal)} pub=${rN.publishedRev}`)
  if (rN2) check(`O2C-${tag}-1b 置換の却下で N2 は公開されない（下書き／なし）`, ['draft'].includes(rN2.status) && rN2.publishedRev == null && !rN2.flags.pmPending, `${rN2.status} pub=${rN2.publishedRev}`)
} else {
  if (kind === 'cancel') check(`O2C-${tag}-1 Rev.d 承認で N は取消（または下書きの削除）・購買の対象でない`, ['cancelled', 'draft'].includes(rN.status) && !rN.pendingRemoval, `${rN.status}`)
  else check(`O2C-${tag}-1 Rev.d 承認で N は置換済・N2 が公開`, rN.status === 'replaced' && rN2 && rN2.status === 'submitted' && !rN2.flags.pmPending, `${rN.status} ${rN2?.status}`)
}
check(`O2C-${tag}-2 Rev.c は D だけに効く（${dec3}）`, dec3 === 'A3' ? rD.qtyNeeded === qD + 1 : rD.qtyNeeded === qD && rD.working?.qtyNeeded === qD + 1, `D q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
check(`O2C-${tag}-3 承認待ちの変更セットが残らない`, !p.submissions.some((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null), c.subs(p))
await t.role('purchasing'); const in9N = await h.inView('purchasing', 9, N); const in9N2 = N2 ? await h.inView('purchasing', 9, N2) : false
const n0 = t.downloads.length; await h.requestTo(null).catch(() => {}); await page.waitForTimeout(1500); const fl = await h.files(n0)
const inRough = fl.some((f) => f.ids.includes(N)), inRough2 = N2 ? fl.some((f) => f.ids.includes(N2)) : false
log('purchasing 9 N', in9N, 'N2', in9N2, 'rough N', inRough, 'N2', inRough2)
check(`O2C-${tag}-4 取消／却下後の N が購買の 9・概算の依頼に出ない`, !in9N && !inRough, `in9=${in9N} rough=${inRough}`)
if (N2) check(`O2C-${tag}-5 N2 が購買の 9・概算に出るのは Rev.d 承認のときだけ`, (in9N2 && inRough2) === (dec4 === 'A4') && (dec4 === 'A4' || (!in9N2 && !inRough2)), `in9=${in9N2} rough=${inRough2}`)
const ex = await c.excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => [N, N2].includes(r[3]) && r[0] !== '').map((r) => [r[0], r[3], String(r[7] ?? '').slice(0, 24), String(r[8] ?? '')])
log('purchasing 変更点 N/N2', JSON.stringify(chg))
if (dec4 === 'R4') check(`O2C-${tag}-6 却下で下書きに戻った N・N2 は購買の変更点に出ない（M20-06）`, chg.length === 0, JSON.stringify(chg))
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
