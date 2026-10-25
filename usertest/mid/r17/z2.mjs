// z2: 発注済の行の対策不成立（g・b が出ないこと）、発注後変更依頼の却下と Ctrl+Z の文、承認 → 外す → 再発注ガード → Ctrl+Z/Ctrl+Y → 置換、PM の Ctrl+Z
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const [X, Y, Z] = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).map((r) => r.id)
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return r ? `${rid}:${r.status}:ord=${!!r.ordered}:cm=${r.flags.countermeasure ?? '-'}:oca=${!!r.flags.orderCancelApproved}:leadNG=${!!r.flags.leadNG} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}`).join(',')}` : rid + ':none' }
await t.press('8')
for (const id of [X, Y, Z]) { const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape') }
await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
for (const id of [X, Y, Z]) log('o', id, await t.order(id))
const money0 = await t.money(); log('money after order', money0)
// ---- A: X 発注済・入荷予定が遅い → PM d → 設計「代替なし」→ 対策不成立 → 決定パネル
await t.showCol('promisedDate'); await t.setCellKey(X, 'promisedDate', '2026-12-20'); await t.press('Escape')
await t.role('pm'); await t.press('7'); let res = await t.decide(X, 'd', '代替品を検討'); log('PM d X →', res.toast, JSON.stringify(res.panel?.options))
await t.role('design'); await t.press('1'); await t.goto(X); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
let pn = await t.panel(); log('design issue panel', JSON.stringify(pn?.options))
await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('X after 代替なし', st(p, X), 'ball', await t.cellText(X, 'ball'))
await t.role('pm'); await t.press('7'); await t.goto(X); await t.press('Enter'); await page.waitForTimeout(80); pn = await t.panel(); log('PM panel X', pn?.title, JSON.stringify(pn?.options))
await t.press('g'); await page.waitForTimeout(80); const gX = await t.toast(); if (await t.panel()) await t.press('Escape')
await t.goto(X); await t.press('Enter'); await page.waitForTimeout(80); await t.press('b'); await page.waitForTimeout(80); const bX = await t.toast(); if (await t.panel()) await t.press('Escape')
p = await t.proj(); log('g →', gX, '| b →', bX, '|', st(p, X))
check('Z2-1 発注済の行の対策不成立は、決定パネルが e と受入だけ（b・g は出ず、押しても状態が変わらない。§9.1・§16）', !(pn?.options ?? []).some((o) => /^(b|g) /.test(o)) && p.rows.find((r) => r.id === X).ordered && p.rows.find((r) => r.id === X).status === 'ordered', JSON.stringify(pn?.options))
// ---- B: Y 購買が発注後変更依頼 → PM 却下 → 購買 o / Ctrl+Z
await t.role('purchasing'); await t.press('1'); await t.goto(Y); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('仕様変更で取消したい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); await t.goto(Y); await t.press('Shift+Y'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await t.promptFill('取消は認めない'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80) } log('PM Shift+Y Y →', await t.toast())
p = await t.proj(); log('Y after reject', st(p, Y), 'ball', await t.cellText(Y, 'ball'))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(Y); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); const oY = await t.toast(); log('o Y →', oY)
const zs = []
for (let i = 0; i < 4; i++) { await t.press('Control+z'); await page.waitForTimeout(80); zs.push(await t.toast()) }
p = await t.proj(); zs.forEach((z, i) => log(`Ctrl+Z #${i + 1} →`, z)); log('Y', st(p, Y))
const guardMsg = zs.find((z) => /発注後変更依頼/.test(z)) ?? ''
check('Z2-2 (U6-03) PM の判断で戻せないときの文が「別の操作で変わっています」にならない', guardMsg && !/別の操作/.test(guardMsg), guardMsg)
// Ctrl+Z の取り消しを全部やり直す
for (let i = 0; i < 4; i++) { await t.press('Control+y'); await page.waitForTimeout(60) }
// ---- C: Z 発注後変更依頼 → PM 承認 → 外す → o（押し間違い）→ Ctrl+Z → Ctrl+Y → o
await t.press('1'); await t.goto(Z); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('別型式へ'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); res = await t.yes(Z, '承認'); log('PM y Z →', res.toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(Z); await t.colKey('ordered')
await t.press('o'); await page.waitForTimeout(60); const un = await t.toast()
await t.press('o'); await page.waitForTimeout(60); const re = await t.toast()
p = await t.proj(); log('unorder →', un, '| re-order →', re, '|', st(p, Z))
check('Z2-3 (M6-03) 承認で外した行に o を押しても再発注されない（理由が出る）', !p.rows.find((r) => r.id === Z).ordered && /置き換え/.test(re), re)
await t.press('Control+z'); await page.waitForTimeout(80); const z1 = await t.toast(); p = await t.proj(); const afterZ = st(p, Z)
await t.press('Control+y'); await page.waitForTimeout(80); const y1 = await t.toast(); p = await t.proj(); const afterY = st(p, Z)
log('Ctrl+Z →', z1, '|', afterZ); log('Ctrl+Y →', y1, '|', afterY)
check('Z2-4 外した発注を Ctrl+Z で戻した直後の Ctrl+Y で、もう一度外せる（自分の操作のやり直し）', !p.rows.find((r) => r.id === Z).ordered, y1)
if (p.rows.find((r) => r.id === Z).ordered) { await t.goto(Z); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('o →', await t.toast()) }
// PM が承認を Ctrl+Z（購買が外したあと）
await t.role('pm'); await t.press('Control+z'); await page.waitForTimeout(80); const pmZ = await t.toast(); p = await t.proj(); log('PM Ctrl+Z after unorder →', pmZ, '|', st(p, Z))
check('Z2-5 購買が発注を外したあとの PM の Ctrl+Z（承認の取り消し）は、発注を外した行と食い違う状態を作らない', !(p.rows.find((r) => r.id === Z).flags.orderCancelApproved === false && !p.rows.find((r) => r.id === Z).ordered && p.issues.some((i) => i.rowId === Z && i.kind === '発注後変更依頼' && i.status === 'open')), `${pmZ} | ${st(p, Z)}`)
if (/元に戻す/.test(pmZ)) { await t.press('Control+y'); await page.waitForTimeout(80); log('PM Ctrl+Y →', await t.toast()) }
// 設計が置換 → 公開
await t.role('design'); await t.press('4'); log('design 4 has Z', (await t.viewRows()).includes(Z), 'ball', await t.cellText(Z, 'ball'))
await t.press('1'); await t.goto(Z); await page.keyboard.rawPress('Alt+r'); await page.waitForTimeout(120); await t.promptFill('NEW-' + Z); await page.keyboard.press('Enter'); await page.waitForTimeout(120); log('Alt+r →', await t.toast())
p = await t.proj(); const nZ = p.rows.find((r) => r.replaces === Z)?.id; log('new', nZ)
log('publish →', await t.publish('5'))
p = await t.proj(); log('old', st(p, Z)); log('new', st(p, nZ), JSON.stringify(p.quotes.filter((q) => q.rowId === nZ).map((q) => [q.supplierId, q.unitPrice, q.stale])))
const money1 = await t.money(); log('money after replace', money1)
check('Z2-6 置換の公開で元行は置換済、新行は購買のボール', p.rows.find((r) => r.id === Z).status === 'replaced' && (await t.cellText(nZ, 'ball')) === '購買', st(p, nZ))
await t.role('purchasing'); await t.press('4'); log('purch 4 has new', (await t.viewRows()).includes(nZ)); await t.press('5'); log('purch 5 has new', (await t.viewRows()).includes(nZ))
await t.shot('z2-after-replace')
summary(); await t.close()
