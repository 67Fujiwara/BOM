// n2: 承認 ON。承認待ちの「追加行」をあとの変更セットにまとめる（M19-02 の修正の確認と一部の行だけのまとめ）
//   mode=addappr   : Rev.c＝N 追加＋D 必要数 → Rev.d＝N の部品名 → Rev.d を N で承認（N 公開）→ Rev.c を D で承認
//   mode=addrej    : 同じ → Rev.d を N で却下（N は下書き。購買の 9・概算の依頼に出ない）→ 設計が公開し直す → 承認
//   mode=addrej2   : addrej の順序違い：Rev.c を D で先に承認 → そのあと Rev.d を N で却下（N の追加はまだ誰も承認していない）
//   mode=addpartial: Rev.c＝N・N2 追加＋D 必要数 → Rev.d＝N の部品名 → Rev.d を却下（N は下書き、N2・D は Rev.c の承認待ちのまま）→ Rev.c を承認（N2・D が公開、N は下書きのまま）
//   mode=addcrej   : 同じ形 → Rev.c を却下（D は作業中、N2 は下書き、N は Rev.d の承認待ちのまま）→ Rev.d を承認（N 公開）
//   mode=addchain  : Rev.c＝N 追加（＋D）→ Rev.d＝N の部品名 → Rev.e＝N の部品名 → Rev.e を却下（N は下書き。Rev.c・d に承認待ちが残らない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
const mode = process.argv[2] ?? 'addappr'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const D = sel[1].id, qD = sel[1].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
let N2 = null
if (mode === 'addpartial' || mode === 'addcrej') N2 = await h.addRow(N, '追加行M', 'G3VM-61A2', 'オムロン', '相見積', '', '4')
log('N', N, 'N2', N2)
log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
const rev = async () => (await t.proj()).submissions.at(-1).rev
const revC = await rev(); let p = await t.proj()
log('after Rev.c', c.subs(p), h.show(p, N), 'pendingRev', rowOf(p, N).pendingRev)
log('N name →', await t.setCellKey(N, 'name', '追加行N2')); log('publish Rev.d →', await t.publish('3'))
const revD = await rev(); let revE = null
if (mode === 'addchain') { log('N name again →', await t.setCellKey(N, 'name', '追加行N3')); log('publish Rev.e →', await t.publish('6')); revE = await rev() }
const last = revE ?? revD
p = await t.proj(); log('subs', c.subs(p))
checkInv('N2-0', p)
check(`N2-1 N は Rev.${last} の承認待ち、Rev.c に N は Rev.${last}（以降）にまとめた印`, rowOf(p, N).pendingRev === last && p.submissions.find((s) => s.rev === revC).changeSet.merged?.[N] != null, c.subs(p))
const pan = await c.panelOf(N); log('panel N', pan?.title)
check('N2-2 N の決定パネルはまとめた Rev を出す', new RegExp(`Rev\\.${last}（Rev\\.${revC}`).test(pan?.title ?? ''), pan?.title)
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast); return y }
async function pmN(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.decide(id, 'Shift+Y', txt); log('PM Shift+Y', id, '→', y.toast); return y }
const inRough = async (id) => { await t.role('purchasing'); const rq = await h.requestTo(null); return rq.f.some((f) => f.ids.includes(id)) }
if (mode === 'addappr') {
  await pmY(N, 'Rev.d 承認'); p = await t.proj()
  check('N2-3 Rev.d の承認で N は公開（提出済・承認待ちでない）、名前は 追加行N2', rowOf(p, N).status === 'submitted' && !rowOf(p, N).flags.pmPending && rowOf(p, N).name === '追加行N2', h.show(p, N) + ' ' + rowOf(p, N).name)
  check('N2-3b D は Rev.c の承認待ちのまま', rowOf(p, D).flags.pmPending && rowOf(p, D).qtyNeeded === qD, h.show(p, D))
  checkInv('N2-3c', p)
  await pmY(D, 'Rev.c 承認'); p = await t.proj()
  check('N2-4 Rev.c の承認で D の必要数が公開値、N は変わらない', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, N).status === 'submitted' && rowOf(p, N).name === '追加行N2', h.show(p, N))
  checkInv('N2-4c', p)
  log('purch 9 has N', await h.inView('purchasing', 9, N))
  check('N2-5 承認した N は概算見積の依頼に出る', await inRough(N), '')
} else if (mode === 'addrej' || mode === 'addrej2' || mode === 'addpartial' || mode === 'addchain') {
  if (mode === 'addrej2') { await pmY(D, 'Rev.c を先に承認'); p = await t.proj(); log('Rev.c approved first', c.subs(p), h.show(p, N)); checkInv('N2-2c', p) }
  await pmN(N, '追加は認めない'); p = await t.proj(); const rN = rowOf(p, N)
  log('after reject', c.subs(p), h.show(p, N), 'name', rN.name, 'status', rN.status, 'publishedRev', rN.publishedRev)
  check('N2-3 却下で N は下書き（提出前）に戻り、公開の印・承認待ちの印なし、部品名は設計の最新値', rN.status === 'draft' && rN.publishedRev == null && !rN.flags.pmPending && rN.name === (mode === 'addchain' ? '追加行N3' : '追加行N2'), `${rN.status} pub=${rN.publishedRev} pm=${rN.flags.pmPending} name=${rN.name} w=${JSON.stringify(rN.working ?? null)} pa=${JSON.stringify(rN.pendingApproval ?? null)}`)
  checkInv('N2-3c', p)
  check('N2-3d 購買の 9 に N は出ない', !(await h.inView('purchasing', 9, N)), '')
  check('N2-3e 概算見積の依頼に N は出ない', !(await inRough(N)), '')
  if (mode === 'addpartial') {
    check('N2-4 N2・D は Rev.c の承認待ちのまま', rowOf(p, N2).flags.pmPending && rowOf(p, N2).pendingRev === revC && rowOf(p, D).flags.pmPending && rowOf(p, D).pendingRev === revC, `${h.show(p, N2)} ${h.show(p, D)}`)
    await pmY(D, 'Rev.c 承認'); p = await t.proj()
    check('N2-5 Rev.c の承認で N2 は公開、D の必要数が公開値、N は下書きのまま', rowOf(p, N2).status === 'submitted' && !rowOf(p, N2).flags.pmPending && rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, N).status === 'draft', `N2=${rowOf(p, N2).status} D=${rowOf(p, D).qtyNeeded} N=${rowOf(p, N).status}`)
    checkInv('N2-5c', p)
  } else if (mode === 'addrej2') {
    check('N2-4 Rev.c は先に承認済、D の必要数が公開値', rowOf(p, D).qtyNeeded === qD + 1, '')
    await t.role('design'); await t.press('1'); log('publish again →', await t.publish('1')); p = await t.proj()
    log('after republish', c.subs(p), h.show(p, N))
    checkInv('N2-5c', p)
  } else if (mode === 'addrej') {
    await pmY(D, 'Rev.c 承認'); p = await t.proj()
    check('N2-4 Rev.c の承認で D の必要数が公開値、N は下書きのまま', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, N).status === 'draft', `D=${rowOf(p, D).qtyNeeded} N=${rowOf(p, N).status}`)
    await t.role('design'); await t.press('1'); log('publish again →', await t.publish('1')); p = await t.proj()
    log('after republish', c.subs(p), h.show(p, N))
    check('N2-5 設計が公開し直すと N は新しい承認待ち（提出済）', rowOf(p, N).status === 'submitted' && rowOf(p, N).flags.pmPending && rowOf(p, N).pendingRev === p.submissions.at(-1).rev, h.show(p, N) + ' pendingRev=' + rowOf(p, N).pendingRev)
    await pmY(N, '追加を認める'); p = await t.proj()
    check('N2-6 承認で N は公開', rowOf(p, N).status === 'submitted' && !rowOf(p, N).flags.pmPending, h.show(p, N))
    checkInv('N2-6c', p)
  } else {
    check('N2-4 Rev.c・Rev.d に承認待ちが残らない（まとめた）', p.submissions.filter((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null).length === 1, c.subs(p))
    await pmY(D, 'Rev.c 承認'); p = await t.proj(); checkInv('N2-5c', p)
  }
} else if (mode === 'addcrej') {
  await pmN(D, 'Rev.c は不可'); p = await t.proj()
  log('after reject Rev.c', c.subs(p), h.show(p, N), h.show(p, N2), h.show(p, D))
  check('N2-3 Rev.c の却下で D は作業中に戻り、N2（Rev.c だけ）は下書き、N は Rev.d の承認待ちのまま', rowOf(p, D).working?.qtyNeeded === qD + 1 && rowOf(p, D).qtyNeeded === qD && rowOf(p, N2).status === 'draft' && rowOf(p, N).flags.pmPending && rowOf(p, N).pendingRev === revD && rowOf(p, N).status === 'submitted', `D w=${JSON.stringify(rowOf(p, D).working)} N2=${rowOf(p, N2).status} N=${rowOf(p, N).status} pend=${rowOf(p, N).pendingRev}`)
  checkInv('N2-3c', p)
  await pmY(N, 'Rev.d 承認'); p = await t.proj()
  check('N2-4 Rev.d の承認で N は公開（部品名 追加行N2）', rowOf(p, N).status === 'submitted' && !rowOf(p, N).flags.pmPending && rowOf(p, N).name === '追加行N2', h.show(p, N))
  checkInv('N2-4c', p)
}
p = await t.proj(); log('final', c.subs(p))
for (const role of ['design', 'purchasing', 'pm']) {
  const rows = await c.chg(role, N); log(role, '変更点 N', JSON.stringify(rows))
  const r1 = revRow(rows, revC)
  check(`N2-X-${role}-1 変更点：Rev.${revC} の N（追加）は「まとめた」か（購買は承認されたものだけ）`, role === 'purchasing' ? (!r1 || /まとめた|\d{4}-\d\d/.test(r1[3])) : (r1 && /追加/.test(r1[2]) && /まとめた/.test(r1[3])), JSON.stringify(r1 ?? null))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
