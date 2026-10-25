// n17: 承認 ON。PM の決定を Ctrl+Z で戻す（まとめた変更セットのあと）／設計の Ctrl+Z／履歴パネル
//   Rev.c＝C・D の必要数 → Rev.d＝C の部品名 → PM が Rev.d(C) を承認 → Ctrl+Z（PM）→ 状態が承認前に戻る → もう一度承認 → Rev.c(D) 承認 → Ctrl+Z
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded, nC = sel[0].name
await t.press('1')
log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish Rev.d →', await t.publish('3'))
let p = await t.proj(); const before = c.subs(p); const snapC = JSON.stringify([rowOf(p, C).pendingRev, rowOf(p, C).pendingApproval, rowOf(p, C).flags.pmPending]); log('before', before)
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast) }
await pmY(C, 'Rev.d 承認'); p = await t.proj(); const mid = c.subs(p); log('after approve d', mid, h.show(p, C)); checkInv('N17-1', p)
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z'); await page.waitForTimeout(200); p = await t.proj(); log('PM Ctrl+Z →', await t.toast())
log('after undo', c.subs(p), h.show(p, C)); checkInv('N17-2', p)
check('N17-2 PM の Ctrl+Z で決定が戻る（承認待ちの Rev.d・まとめた印・C の値）', c.subs(p) === before && JSON.stringify([rowOf(p, C).pendingRev, rowOf(p, C).pendingApproval, rowOf(p, C).flags.pmPending]) === snapC && rowOf(p, C).name === nC, c.subs(p))
await pmY(C, 'Rev.d 承認 2 回目'); p = await t.proj(); check('N17-3 戻したあとにもう一度承認できる（C の必要数・部品名）', rowOf(p, C).qtyNeeded === qC + 1 && rowOf(p, C).name === 'NAME-C2', h.show(p, C)); checkInv('N17-3c', p)
await pmY(D, 'Rev.c 承認'); p = await t.proj(); checkInv('N17-4c', p)
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z'); await page.waitForTimeout(200); p = await t.proj(); log('PM Ctrl+Z (Rev.c) →', await t.toast()); log(c.subs(p), h.show(p, D))
check('N17-4 Rev.c の承認を戻すと D は承認待ち・必要数は元の ' + qD, rowOf(p, D).flags.pmPending && rowOf(p, D).qtyNeeded === qD && p.submissions.find((s) => s.rev === 3).changeSet.approved === false, h.show(p, D))
checkInv('N17-4d', p)
// 設計の Ctrl+Z：公開済の値は戻らない
await t.role('design'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z'); await page.waitForTimeout(200); p = await t.proj(); log('design Ctrl+Z →', await t.toast()); checkInv('N17-5c', p)
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
