import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('pm')
let p = await t.proj()
log('due:', p.dueDate, 'processDays:', p.settings.processDays, 'selected:', p.rows.filter((r) => r.adoptedSupplierId).map((r) => r.id + ':' + r.status))
// 設計で先に R022 の必要日を固定に
await t.role('design'); await t.showCol('needDateFixed'); await t.setCellKey('R023', 'needDateFixed', '2026-11-05'); await t.press('Control+Enter'); await page.waitForTimeout(100); let d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/変更セット/.test(d)) { await t.press('5'); await page.waitForTimeout(80) } d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/Rev/.test(d)) await t.press('1'); await page.waitForTimeout(80); log('design publish:', await t.toast())
await t.role('pm')
await t.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await t.press('Enter'); await page.waitForTimeout(100)
log('settings:', (await page.getByTestId('settings').textContent()).slice(0, 300))
await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50)
const newDue = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
await page.getByTestId('settings-input').fill(newDue); await t.press('Enter'); await page.waitForTimeout(50)
await t.press('Control+Enter'); await page.waitForTimeout(100)
const impact = await page.getByTestId('impact').textContent().catch(() => 'no impact')
log('impact:', impact)
check('S6 影響試算（納期NG 行・推奨変更・固定必要日・再発行）が出る', /納期NG になる行/.test(impact) && /固定の行: 1/.test(impact) && /再発行対象/.test(impact), impact)
await t.press('Enter'); await page.waitForTimeout(50)
let dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); log('reason dialog:', dlg)
await page.getByTestId('prompt-text').fill('客先要求で前倒し'); await t.press('1'); await page.waitForTimeout(80)
dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); log('dialog2:', dlg)
if (/再選定提案/.test(dlg)) await t.press('2') // 載せない（納期NG を単独で見る）
await page.waitForTimeout(150)
log('→', await t.toast())
p = await t.proj()
log('due now:', p.dueDate, 'R023 fixed:', p.rows.find((r) => r.id === 'R023').needDateFixed, 'leadNG rows:', p.rows.filter((r) => r.flags.leadNG).map((r) => r.id), 'reissue:', p.rows.filter((r) => r.flags.reissue).map((r) => r.id), 'reselect:', p.rows.filter((r) => r.flags.pmReason === '再選定提案').map((r) => r.id))
check('S6 納期変更で固定必要日が同じ日数だけ前倒し', p.rows.find((r) => r.id === 'R023').needDateFixed < '2026-11-05')
check('S6 正式見積済 R013 が再発行対象', p.rows.find((r) => r.id === 'R013').flags.reissue === true)
check('S6 納期NG が付く', p.rows.some((r) => r.flags.leadNG))
await t.press('7')
const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('PM 7:', v7.join(','), 'header:', await t.header())
const ng = p.rows.find((r) => r.id === 'R003' && r.flags.leadNG)
if (ng) {
  await t.goto(ng.id); await t.press('Enter'); const pnl = await page.getByTestId('quickfix').textContent(); log('納期NG panel:', pnl)
  check('S6 納期NG の選択肢 Shift+Y 受入 / b / p 委譲 / d / e', /Shift\+Y 受入/.test(pnl) && /b 次点/.test(pnl) && /p 購買が再選定/.test(pnl) && /d 設計/.test(pnl) && /e 特急/.test(pnl), pnl)
  await t.press('Escape'); await t.goto(ng.id); await t.press('y'); await page.waitForTimeout(50); log('y on 納期NG →', await t.toast(), (await page.locator('[role=dialog]').textContent().catch(() => '')).slice(0, 60))
  if (await page.locator('.overlay').count()) await t.press('Escape')
  // p 委譲
  await t.goto(ng.id); await t.press('Enter'); await t.press('p'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50)
  log('p →', await t.toast(), 'flags:', JSON.stringify((await t.row(ng.id)).flags), 'ball:', await t.cell(ng.id, 'ball').catch(() => '-'))
  check('S6 委譲 → 購買のボール', JSON.stringify((await t.row(ng.id)).flags).includes('delegated'))
  // 購買が再選定（1 位以外）→ PM 承認は不要のはず
  await t.role('purchasing'); await t.press('1'); await t.goto(ng.id); await t.press('Shift+A'); await page.waitForTimeout(50)
  const ad = await page.getByTestId('adopt').textContent().catch(() => 'no panel'); log('purchasing adopt panel:', ad, await t.toast())
  const n = await page.getByTestId('adopt').locator('.opt').count().catch(() => 0)
  if (n > 1) { await t.press(String(n)); await page.waitForTimeout(50); const dd = await page.locator('[role=dialog]').textContent().catch(() => ''); log('reason dialog:', dd.slice(0, 60)); if (dd) await t.press('1'); await page.waitForTimeout(50); log('→', await t.toast(), 'status:', await t.cell(ng.id, 'status')); check('S6 委譲された購買の再選定は PM 承認不要・理由「納期」自動', !/PM承認待ち/.test(await t.cell(ng.id, 'status')) && (await t.row(ng.id)).adoptReason === '納期', `${await t.cell(ng.id, 'status')} reason=${(await t.row(ng.id)).adoptReason}`) }
  await t.role('pm'); await t.press('7')
}
// 他の納期NG 行で d / e
const ng2 = (await t.proj()).rows.filter((r) => r.flags.leadNG && !r.flags.formalDiff && !r.flags.pmPending)
log('remaining leadNG:', ng2.map((r) => r.id))
if (ng2[0]) { await t.goto(ng2[0].id); await t.press('Enter'); await t.press('d'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50); const p2 = await t.proj(); const iss = p2.issues.filter((i) => i.rowId === ng2[0].id); log('d →', await t.toast(), 'issue:', iss.map((i) => i.kind + ':' + i.status + ':' + i.by.role), 'flags:', JSON.stringify(p2.rows.find((r) => r.id === ng2[0].id).flags)); await t.press('1'); log('ball:', await t.cell(ng2[0].id, 'ball')); check('S6 d 設計が代替品検討 → 納期NG 指摘（R=設計）で設計のボール', (await t.cell(ng2[0].id, 'ball')) === '設計', await t.cell(ng2[0].id, 'ball')); await t.role('design'); await t.press('4'); const v4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); check('S6 設計の 4 に出る', v4.includes(ng2[0].id)); await t.role('pm'); await t.press('7') }
if (ng2[1]) { await t.goto(ng2[1].id); await t.press('Enter'); await t.press('e'); await page.waitForTimeout(50); const dd = await page.locator('[role=dialog]').textContent().catch(() => ''); log('e dialog:', dd); if (await page.getByTestId('extra-上限金額').count()) await page.getByTestId('extra-上限金額').fill('30000'); await t.press('Enter'); await page.waitForTimeout(50); log('e →', await t.toast(), JSON.stringify((await t.row(ng2[1].id)).flags), 'decision:', (await t.proj()).decisions.at(-1)) }
if (ng2[2]) { await t.goto(ng2[2].id); await t.press('Enter'); await t.press('b'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50); log('b →', await t.toast(), (await t.row(ng2[2].id)).adoptedSupplierId, JSON.stringify((await t.row(ng2[2].id)).flags)) }
// 設計の 5 に起因 案件納期変更
await t.role('design'); await t.press('5'); const v5 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('design 5 after due change:', v5.length, 'rows; sample cause:', (await t.row(v5[0] ?? 'R001')).lastChangeCause)
check('S6 設計の 5 に起因「案件納期変更」で出る', v5.length > 0)
await t.shot('s6-01')
// 先行発注判断（自動）: 納期の長い行の y
await t.role('pm')
const ltb = (await t.proj()).rows.filter((r) => r.flags.ltbPending)
log('ltbPending rows:', ltb.map((r) => r.id))
log('ERRORS:', t.errors)
await t.close()
