// n11: 承認 ON。承認待ちの変更セットの周りの境界（取消・置換・追加・Ctrl+Z）
//   mode=addcancel : Rev.c＝N 追加＋D → Rev.d＝N の取消（まだ承認されていない追加の取消）→ Rev.d を却下／承認
//   mode=cancelagain: C 取消（Rev.d 承認待ち）のあと設計が C でもう一度 Shift+Delete／必要数を編集／Ctrl+Z
//   mode=repladd   : Rev.c＝N 追加 → N を置換（r）→ 公開（Rev.d）→ 承認
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
const mode = process.argv[2] ?? 'addcancel'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded
await t.press('1')
async function cancel(id) {
  await t.goto(id); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel()
  if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) }
  return t.toast()
}
const rev = async () => (await t.proj()).submissions.at(-1).rev
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast); return y }
async function pmN(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.decide(id, 'Shift+Y', txt); log('PM Shift+Y', id, '→', y.toast); return y }
let p
if (mode === 'addcancel' || mode === 'repladd') {
  const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
  log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1')); const revC = await rev()
  let N2 = null
  if (mode === 'addcancel') log('N cancel →', await cancel(N))
  else { log('N replace →', await t.replace(N, 'G3VM-61A9')); p = await t.proj(); N2 = p.rows.find((r) => r.replaces === N)?.id; log('N2', N2) }
  log('publish Rev.d →', await t.publish('1')); const revD = await rev(); p = await t.proj()
  log('subs', c.subs(p), 'N', h.show(p, N), 'pendingRev', rowOf(p, N).pendingRev, JSON.stringify(rowOf(p, N).pendingRemoval ?? null), 'N2', N2 ? h.show(p, N2) : '')
  checkInv('N11-0', p)
  if (mode === 'addcancel') {
    if (process.argv[3] === 'approve') {
      await pmY(N, 'Rev.d 承認'); p = await t.proj(); log('N', h.show(p, N), rowOf(p, N).status)
      check('N11-1 承認されていない追加 N の取消を承認すると N は取消', rowOf(p, N).status === 'cancelled' || rowOf(p, N).status === 'draft', rowOf(p, N).status)
      checkInv('N11-1c', p)
      await pmY(D, 'Rev.c 承認'); p = await t.proj(); checkInv('N11-2c', p)
      check('N11-2 Rev.c の承認で D の必要数が公開値、取消した N は復活しない', rowOf(p, D).qtyNeeded === qD + 1 && ['cancelled', 'draft'].includes(rowOf(p, N).status), `${rowOf(p, D).qtyNeeded} ${rowOf(p, N).status}`)
    } else {
      await pmN(N, 'Rev.d 却下'); p = await t.proj(); const rn = rowOf(p, N)
      log('after reject', c.subs(p), h.show(p, N), 'removal', JSON.stringify(rn.removal ?? null), 'status', rn.status, 'pub', rn.publishedRev)
      checkInv('N11-1c', p)
      check('N11-1 Rev.d の却下で N の追加は承認されていないので下書きに戻る。下書きに取消の作業が残らない', rn.status === 'draft' && !rn.removal && !rn.pendingRemoval, `${rn.status} removal=${JSON.stringify(rn.removal)}`)
      log('purch 9 has N', await h.inView('purchasing', 9, N))
      await t.role('design'); await t.press('1'); log('design publish →', await t.publish('1')); p = await t.proj(); log('after republish', c.subs(p), h.show(p, N), rowOf(p, N).status)
      checkInv('N11-3c', p)
    }
  } else {
    await pmY(N, 'Rev.d 承認'); p = await t.proj(); log('after', c.subs(p), 'N', h.show(p, N), rowOf(p, N).status, 'N2', h.show(p, N2), rowOf(p, N2).status)
    checkInv('N11-1c', p)
    check('N11-1 承認されていない追加 N の置換を承認すると N は置換済・N2 が公開', rowOf(p, N).status === 'replaced' && rowOf(p, N2).status === 'submitted', `${rowOf(p, N).status} ${rowOf(p, N2).status}`)
    check('N11-2 Rev.c の追加は D だけ承認待ちで残る', rowOf(p, D).flags.pmPending, '')
    await pmY(D, 'Rev.c 承認'); p = await t.proj(); checkInv('N11-3c', p)
  }
} else {
  log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1')); const revC = await rev()
  log('C cancel →', await cancel(C)); log('publish Rev.d →', await t.publish('1')); const revD = await rev(); p = await t.proj()
  log('subs', c.subs(p), 'C', h.show(p, C), JSON.stringify(rowOf(p, C).pendingRemoval ?? null)); checkInv('N11-0', p)
  // 1) もう一度 Shift+Delete
  log('C Shift+Delete again →', await cancel(C)); p = await t.proj()
  log('after', c.subs(p), 'C', JSON.stringify([rowOf(p, C).status, rowOf(p, C).pendingRev, rowOf(p, C).pendingRemoval ?? null, rowOf(p, C).removal ?? null, rowOf(p, C).working ?? null]))
  checkInv('N11-1c', p)
  // 2) 必要数の編集
  log('C qty edit →', await t.setCellKey(C, 'qtyNeeded', String(qC + 5))); p = await t.proj()
  log('after edit', JSON.stringify([rowOf(p, C).status, rowOf(p, C).pendingRev, rowOf(p, C).pendingApproval ?? null, rowOf(p, C).pendingRemoval ?? null, rowOf(p, C).removal ?? null, rowOf(p, C).working ?? null]))
  checkInv('N11-2c', p)
  // 3) Ctrl+Z
  await page.keyboard.press('Control+z'); await page.waitForTimeout(150); p = await t.proj(); log('Ctrl+Z →', await t.toast())
  log('after undo', c.subs(p), JSON.stringify([rowOf(p, C).status, rowOf(p, C).pendingRev, rowOf(p, C).pendingApproval ?? null, rowOf(p, C).pendingRemoval ?? null, rowOf(p, C).removal ?? null, rowOf(p, C).working ?? null]))
  checkInv('N11-3c', p)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(150); p = await t.proj(); log('Ctrl+Z 2 →', await t.toast())
  log('after undo2', c.subs(p), JSON.stringify([rowOf(p, C).status, rowOf(p, C).pendingRev, rowOf(p, C).pendingApproval ?? null, rowOf(p, C).pendingRemoval ?? null, rowOf(p, C).removal ?? null, rowOf(p, C).working ?? null]))
  checkInv('N11-4c', p)
  // PM が承認 → 設計の作業中の編集はどうなるか
  await t.role('pm'); await t.press('7'); const vr = await t.viewRows(); log('PM 7 rows', vr.join(','))
  const y = await pmY(C, 'Rev.d 承認'); p = await t.proj(); log('after PM', c.subs(p), JSON.stringify([rowOf(p, C).status, rowOf(p, C).pendingRev, rowOf(p, C).working ?? null]))
  checkInv('N11-5c', p)
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
