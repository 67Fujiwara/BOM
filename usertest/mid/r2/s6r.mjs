import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// 固定必要日の行を 1 つ作って公開
await t.press('1'); await t.showCol('needDateFixed'); await t.press('1')
await t.goto('R070'); await t.colKey('needDateFixed'); await t.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('2026-11-12'); await t.press('Enter')
for (let k = 0; k < 6; k++) { await t.press('Control+Enter'); await page.waitForTimeout(80); const tt = await t.toast(); if (/未確認の警告/.test(tt)) { const id = tt.match(/（(R\d+)/)[1]; await t.goto(id); await t.colKey('model'); await t.press('x') } else break }
let dlg = await t.dialog(); if (/変更セット/.test(dlg)) { await t.press('Enter'); await page.waitForTimeout(80) }
dlg = await t.dialog(); if (/Rev/.test(dlg)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('publish fixed →', await t.toast(), JSON.stringify((await t.row('R070')).needDateFixed))
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(200); log('bulk →', await t.toast())
await t.role('purchasing'); await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await t.press('2'); await page.waitForTimeout(1500); log('formal →', await t.toast())
// 1 行は正式単価入力 → 正式見積済 → 発注
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested').map((r) => r.id)
const ordId = fr.find((id) => { const r = p.rows.find((x) => x.id === id); const q = p.quotes.find((q) => q.rowId === id && q.supplierId === r.adoptedSupplierId && !q.stale); return q && q.leadDays > 10 && q.stock !== '在庫' })
log('ordId', ordId)
await t.press('8'); const q0 = p.quotes.find((q) => q.rowId === ordId && q.supplierId === p.rows.find((r) => r.id === ordId).adoptedSupplierId && !q.stale)
await t.setCellKey(ordId, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('3'); await t.goto(ordId); await t.press('o'); await page.waitForTimeout(40); log('ordered', ordId, (await t.row(ordId)).status)
const before7 = (await t.proj()).rows.filter((r) => r.flags.leadNG).map((r) => r.id)
// PM: 納期前倒し
await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(60)
await t.press('ArrowDown'); await t.press('Enter'); await page.getByTestId('settings-input').fill('2026-11-06'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80)
const imp = await page.getByTestId('impact').textContent().catch(() => ''); log('impact:', imp)
check('S6 影響試算に 総額差・特急費概算 が出る', /総額/.test(imp) && /特急/.test(imp), imp.slice(0, 200))
await t.press('Enter'); await page.waitForTimeout(60); log('reason dlg:', (await t.dialog()).slice(0, 120))
await page.getByTestId('prompt-text').fill('客先要求で前倒し'); await t.press('Enter'); await page.waitForTimeout(60)
dlg = await t.dialog(); if (dlg) { log('2nd dlg:', dlg.slice(0, 100)); await t.press('1'); await page.waitForTimeout(80) }
log('settings →', await t.toast(), 'due', (await t.proj()).dueDate, 'R070 fixed:', (await t.row('R070')).needDateFixed)
p = await t.proj()
const ng = p.rows.filter((r) => r.flags.leadNG).map((r) => r.id)
log('leadNG before:', before7.length, 'after:', ng.length, 'reissue:', p.rows.filter((r) => r.flags.reissue).map((r) => r.id).join(','))
check('S6 正式依頼中で必要日が変わった行は再発行対象', fr.every((id) => p.rows.find((r) => r.id === id).flags.reissue || p.rows.find((r) => r.id === id).status === 'ordered'))
await t.press('7'); const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('PM 7 count:', v7.length)
await t.shot('s6-pm7')
// 発注済の行の 納期NG パネル
log('ordId flags:', JSON.stringify((await t.row(ordId)).flags), (await t.row(ordId)).promisedDate)
// 入荷予定日を必要日より後に（購買）→ 発注済の納期NG
await t.role('purchasing'); await t.press('3'); await t.showCol('promisedDate').catch(() => {}); await t.press('3'); await t.setCellKey(ordId, 'promisedDate', '2026-12-20'); log('promised →', JSON.stringify((await t.row(ordId)).flags))
await t.role('pm'); await t.press('7'); await t.goto(ordId); await t.press('Enter'); const pnO = await page.getByTestId('quickfix').textContent().catch(() => t.toast()); log('panel 納期NG(発注済):', pnO); await t.press('Escape')
check('S6 発注済の納期NG では b・p が出ない', !/b 次点/.test(pnO) && !/p 購買/.test(pnO), pnO)
// 発注前の 納期NG: e / p / d
const sel = (await t.proj()).rows.filter((r) => r.flags.leadNG && r.status !== 'ordered').map((r) => r.id)
log('NG rows not ordered:', sel.slice(0, 10).join(','))
const [eId, pId, dId, bId] = sel
await t.goto(eId); await t.press('Enter'); const pn = await page.getByTestId('quickfix').textContent(); log('panel 納期NG:', pn)
await t.press('e'); await page.waitForTimeout(50); log('e dlg:', await t.dialog()); if (await page.getByTestId('extra-上限金額').count()) await page.getByTestId('extra-上限金額').fill('30000'); await page.getByTestId('prompt-text').fill('特急で'); await t.press('Enter'); await page.waitForTimeout(80)
let re = await t.row(eId); log('e →', await t.toast(), JSON.stringify(re.flags), 'ball', await t.cell(eId, 'ball').catch(() => '-'), 'decision', JSON.stringify((await t.proj()).decisions.at(-1)?.payload))
await t.goto(pId); await t.press('Enter'); await t.press('p'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill(''); await t.press('Enter'); await page.waitForTimeout(80)
let rp = await t.row(pId); log('p →', await t.toast(), JSON.stringify(rp.flags), rp.status)
await t.goto(dId); await t.press('Enter'); await t.press('d'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill(''); await t.press('Enter'); await page.waitForTimeout(80)
p = await t.proj(); let rd = p.rows.find((r) => r.id === dId); log('d →', await t.toast(), JSON.stringify(rd.flags), 'issues', p.issues.filter((i) => i.rowId === dId).map((i) => i.kind + ':' + i.status + ':' + i.by.role))
await t.goto(bId); const b0 = (await t.row(bId)).adoptedSupplierId; await t.press('Enter'); await t.press('b'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill(''); await t.press('Enter'); await page.waitForTimeout(80)
let rb = await t.row(bId); log('b →', await t.toast(), b0, '→', rb.adoptedSupplierId, JSON.stringify(rb.flags), rb.status)
// 次点も納期を満たすか
p = await t.proj(); const qb = p.quotes.find((q) => q.rowId === bId && q.supplierId === rb.adoptedSupplierId && !q.stale)
log('b next quote lead', qb?.leadDays, qb?.stock, 'needDate cell', await t.cell(bId, 'needDate').catch(() => '-'))
// 委譲: 購買が Shift+A で選び直す（PM 承認不要）
await t.role('purchasing'); await t.press('1'); await t.goto(pId); await t.press('Shift+A'); await page.waitForTimeout(50)
const ao = await page.getByTestId('adopt').textContent().catch(() => t.toast()); log('purchasing Shift+A on 委譲 row:', ao)
if (await page.getByTestId('adopt').count()) { await t.press('2'); await page.waitForTimeout(50); const d2 = await t.dialog(); log('reason dlg?', d2.slice(0, 50)); if (d2) await t.press('Enter'); await page.waitForTimeout(60) }
rp = await t.row(pId); log('委譲 Shift+A →', await t.toast(), rp.status, rp.adoptReason, JSON.stringify(rp.flags))
check('S6 委譲された購買の再選定は PM 承認なし', !rp.flags.pmPending)
// 設計: 納期NG の指摘に「代替なし」→ 対策不成立
await t.role('design'); await t.press('1'); await t.goto(dId); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50)
const ap = await page.getByTestId('quickfix').textContent().catch(() => ''); log('design panel (納期NG指摘):', ap)
const opts = await page.getByTestId('quickfix').locator('.opt').allTextContents(); const i7 = opts.findIndex((o) => /代替なし/.test(o)); for (let j = 0; j < i7; j++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('代替品なし'); await t.press('Enter'); await page.waitForTimeout(80)
rd = await t.row(dId); log('代替なし →', JSON.stringify(rd.flags), rd.status)
await t.role('pm'); await t.press('7'); await t.goto(dId); await t.press('Enter'); const pn2 = await page.getByTestId('quickfix').textContent().catch(() => t.toast()); log('PM panel 対策不成立(納期):', pn2)
check('S6 納期NG の代替なし → 対策不成立（受入 / b / g / e）', /e /.test(pn2) && !/q 数量/.test(pn2), pn2)
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
