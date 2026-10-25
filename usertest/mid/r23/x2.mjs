// x2: 発注後変更依頼の却下 → 購買の Ctrl+Z、発注前の行への h → 承認 → 発注 → 外す、対策不成立（発注済）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const cands = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).map((r) => r.id)
const [A, B, C] = cands
log('A(reject+undo) B(h before order) C(対策不成立 ordered)', A, B, C)
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return `${rid}:${r.status}:ord=${!!r.ordered}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}${i.pmRuled ? ':ruled' : ''}`).join(',')}` }
await t.press('8')
for (const id of [A, B, C]) { const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape') }
await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
log('o A →', await t.order(A)); log('o C →', await t.order(C))
await t.showCol('promisedDate'); await t.setCellKey(C, 'promisedDate', '2026-12-20'); await t.press('Escape')
// ---- A: 購買 h → PM 却下 → 購買 Ctrl+Z を重ねる
await t.press('1'); await t.goto(A); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('仕様変更のため発注を取消したい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
log('A issue publish →', await t.publish())
await t.role('pm'); await t.press('7'); let res = await t.decide(A, 'Shift+Y', '元の発注のまま'); log('PM Shift+Y A →', res.toast)
p = await t.proj(); log('A after reject', st(p, A), 'ball', await t.cellText(A, 'ball'))
await t.press('7'); log('PM 7 has A after reject?', (await t.viewRows()).includes(A))
await t.role('purchasing')
for (let k = 0; k < 6; k++) { await t.press('Control+z'); await page.waitForTimeout(100); const tt = await t.toast(); p = await t.proj(); const r = p.rows.find((x) => x.id === A); log(`purch Ctrl+Z #${k + 1} →`, tt, '| A', r.status, 'ord', !!r.ordered); if (!r.ordered) break }
await t.press('3'); await t.goto(A); await t.shot('x2-undo-unorder-after-reject')
p = await t.proj(); check('X2-1 PM が発注後変更依頼を却下した行は、購買の Ctrl+Z でも発注済を外せない', p.rows.find((r) => r.id === A).ordered, st(p, A))
// ---- B: 発注前（正式見積済）の行に h → PM 承認 → 発注 → 外す
await t.press('1'); await t.goto(B); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); const hb = await t.toast(); await page.getByTestId('issue-text').fill('発注前だが仕様変更の可能性').catch(() => {}); await page.getByTestId('issue-text').press('Enter').catch(() => {}); await page.waitForTimeout(60)
log('B raise h →', hb, '| publish →', await t.publish())
p = await t.proj(); log('B after h', st(p, B), 'ball', await t.cellText(B, 'ball'))
check('X2-2a 発注前の行には発注後変更依頼を起票できない', !p.issues.some((i) => i.rowId === B && i.kind === '発注後変更依頼'), hb)
if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); p = await t.proj(); if (!p.rows.find((r) => r.id === B).ordered) log('order B →', await t.order(B))
// 発注済の C に h → PM 承認 → 購買が依頼を見送り → o で外せるか（承認の印が残らない）
await t.press('1'); await t.goto(B); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('取消の可能性'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('C publish →', await t.publish())
await t.role('pm'); await t.press('7'); res = await t.yes(B, '承認'); log('PM y C →', res.toast)
await t.role('purchasing'); await t.press('1'); await t.goto(B); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); const ipc = await t.panel(); log('C issue panel (purch)', JSON.stringify(ipc?.options))
const i6c = (ipc?.options ?? []).findIndex((o) => o.startsWith('6')); if (i6c >= 0) { await t.press('6'); await page.waitForTimeout(80); await t.promptFill('取消は不要になった'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80) } else await t.press('Escape')
await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('C after wontfix', st(p, B))
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(B); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('un-order C →', await t.toast())
p = await t.proj(); log('C', st(p, B))
check('X2-2 承認後に購買が依頼を見送りにした行は、承認なしに発注を外せない', p.rows.find((r) => r.id === B).ordered, st(p, B))
// C（対策不成立・発注済）は x3.mjs に移した
summary(); await t.close()
