// m8: 承認 ON。承認待ちの変更セットの行に、あとの変更セットで「取消」「追加した行の編集」を重ねる（M17-03 の修正（行ごとにまとめる）の別の経路）
//   mode=cancel: Rev.c＝C・D の必要数 → Rev.d＝C の取消（Shift+Delete）→ PM が Rev.c を D で承認 → Rev.d を C で却下
//                期待: C の必要数の変更は Rev.d にまとめた扱い（Rev.c の承認では反映しない・「承認」と書かない）。Rev.d の却下で C は取消も必要数も作業中に戻る。変更点と公開値が食い違わない
//   mode=add   : Rev.c＝行 N の追加（承認待ち）＋ D の必要数 → Rev.d＝N の部品名 → PM が Rev.d を N で却下
//                期待: N の追加は承認されていないので、却下で N は下書き（提出前）に戻る（購買の見積・依頼の対象にならない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
const mode = process.argv[2] ?? 'cancel'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded
await t.press('1')
let p, revC, revD
if (mode === 'cancel') {
  log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
  p = await t.proj(); revC = p.submissions.at(-1).rev
  await t.goto(C); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); let pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('客先仕様から削除') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) }
  log('C cancel →', await t.toast()); log('publish Rev.d →', await t.publish('1'))
  p = await t.proj(); revD = p.submissions.at(-1).rev; const rC = c.row(p, C)
  log('subs', c.subs(p), 'C pendingRev', rC.pendingRev, 'pa', JSON.stringify(rC.pendingApproval), 'pRem', JSON.stringify(rC.pendingRemoval ?? null), 'status', rC.status)
  const sc = p.submissions.find((s) => s.rev === revC)
  check('M8C-0 C の必要数（Rev.c）と取消（Rev.d）が重なったとき、Rev.c に C を Rev.d にまとめた印', sc.changeSet.merged?.[C] === revD, c.subs(p))
  const panC = await c.panelOf(C); log('panel C', panC?.title, JSON.stringify(panC?.options))
  check('M8C-1 C の決定パネルが Rev.d（Rev.c の変更をまとめた）', new RegExp(`Rev\\.${revD}（Rev\\.${revC}`).test(panC?.title ?? ''), panC?.title)
  await t.role('pm'); await t.press('7'); log('PM y D →', (await t.yes(D, 'Rev.c 承認')).toast)
  await t.role('pm'); await t.press('7'); log('PM Shift+Y C →', (await t.decide(C, 'Shift+Y', '取消は不可')).toast)
  p = await t.proj(); const rC2 = c.row(p, C)
  log('after', c.subs(p), h.show(p, C), 'status', rC2.status, 'qty', rC2.qtyNeeded, 'working', JSON.stringify(rC2.working ?? null), 'removal', JSON.stringify(rC2.removal ?? null))
  check('M8C-2 Rev.d の却下で C は取消されず、公開値の必要数は ' + qC + ' のまま（必要数の変更は作業中に戻る）', rC2.status !== 'cancelled' && rC2.qtyNeeded === qC, `status=${rC2.status} qty=${rC2.qtyNeeded} w=${JSON.stringify(rC2.working)}`)
  const rows = await c.chg('pm', C); log('pm 変更点 C', JSON.stringify(rows))
  const rc = rows.find((x) => String(x[0]) === String(revC))
  check('M8C-3 変更点：Rev.c の C の行に「承認」（承認者）と必要数の変更が並ばない（公開値は ' + qC + ' のまま）', !(rc && /必要数: \d+ → \d+/.test(rc[2]) && /\d{4}-\d\d-\d\d/.test(rc[3])), JSON.stringify(rc ?? null))
} else {
  const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
  log('N', N); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
  p = await t.proj(); revC = p.submissions.at(-1).rev; log('N after Rev.c', h.show(p, N), 'status', c.row(p, N).status, 'pendingRev', c.row(p, N).pendingRev, 'subs', c.subs(p))
  log('N name →', await t.setCellKey(N, 'name', '追加行N2')); log('publish Rev.d →', await t.publish('3'))
  p = await t.proj(); revD = p.submissions.at(-1).rev; const rN = c.row(p, N)
  log('N after Rev.d', h.show(p, N), 'status', rN.status, 'pendingRev', rN.pendingRev, 'pa', JSON.stringify(rN.pendingApproval ?? null), 'subs', c.subs(p))
  const panN = await c.panelOf(N); log('panel N', panN?.title)
  await t.role('pm'); await t.press('7'); log('PM y D (Rev.c) →', (await t.yes(D, 'Rev.c 承認')).toast)
  p = await t.proj(); log('N after Rev.c approve', h.show(p, N), 'status', c.row(p, N).status)
  await t.role('pm'); await t.press('7'); log('PM Shift+Y N (Rev.d) →', (await t.decide(N, 'Shift+Y', '追加は認めない')).toast)
  p = await t.proj(); const rN2 = c.row(p, N)
  log('N after reject', h.show(p, N), 'status', rN2.status, 'publishedRev', rN2.publishedRev, 'working', JSON.stringify(rN2.working ?? null))
  check('M8A-1 承認されていない追加行 N は、Rev.d の却下で下書き（提出前）に戻る（提出済のまま購買に出ない）', rN2.status === 'draft' || rN2.flags.pmPending, `status=${rN2.status} pm=${rN2.flags.pmPending} publishedRev=${rN2.publishedRev}`)
  const v9 = await h.inView('purchasing', 9, N); log('purch 9 has N', v9)
  const rq = await h.requestTo(null); log('rough →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(N)])))
  check('M8A-2 購買の概算見積の依頼に N が出ない', !rq.f.some((f) => f.ids.includes(N)), JSON.stringify(rq.f.map((f) => [f.sup, f.ids])))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
