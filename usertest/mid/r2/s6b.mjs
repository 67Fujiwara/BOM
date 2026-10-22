import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// 一括採用 → PM が納期を前倒し → 納期NG 多数 → 委譲 → 購買が高い商社を選ぶ
await t.press('Control+k'); await page.getByTestId('palette-input').fill('未採用を推奨で一括採用'); await t.press('Enter'); await page.waitForTimeout(300); log('bulk:', await t.toast())
await t.role('pm')
await t.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await t.press('Enter'); await page.waitForTimeout(100)
await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50)
await page.getByTestId('settings-input').fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(100)
log('impact:', await page.getByTestId('impact').textContent())
await t.press('Enter'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('前倒し'); await t.press('Enter'); await page.waitForTimeout(80)
let dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/再選定提案/.test(dlg)) { await t.press('2'); await page.waitForTimeout(100) }
let p = await t.proj()
const ngs = p.rows.filter((r) => r.flags.leadNG && !r.flags.formalDiff && !r.flags.pmPending)
log('leadNG rows:', ngs.length, 'PM待ち:', await t.lamps())
// 委譲する行: 代替商社が高い行を選ぶ
let target = null
for (const r of ngs) {
  const qs = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice && q.leadDays !== -1)
  const a = qs.find((q) => q.supplierId === r.adoptedSupplierId); const others = qs.filter((q) => q.supplierId !== r.adoptedSupplierId)
  const exp = others.find((q) => a && (q.unitPrice - a.unitPrice) * (r.orderQty ?? r.qtyNeeded) > 10000 && (q.unitPrice - a.unitPrice) / a.unitPrice > 0.03)
  if (exp) { target = { r, exp }; break }
}
log('target:', target?.r.id, target?.exp.supplierId, target?.exp.unitPrice)
if (target) {
  await t.press('7'); await t.goto(target.r.id); await t.press('Enter'); await t.press('p'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50)
  log('委譲 →', JSON.stringify((await t.row(target.r.id)).flags))
  await t.role('purchasing'); await t.press('1'); await t.goto(target.r.id); await t.press('Shift+A'); await page.waitForTimeout(50)
  const opts = await page.getByTestId('adopt').locator('.opt').allTextContents(); log('opts:', opts)
  const sname = (await t.ws()).suppliers.find((s) => s.id === target.exp.supplierId).name
  const idx = opts.findIndex((o) => o.includes(sname))
  await t.press(String(idx + 1)); await page.waitForTimeout(50); dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); if (dlg) { await t.press('6'); await page.waitForTimeout(50) }
  log('→', await t.toast(), 'status:', await t.cell(target.r.id, 'status'), 'reason:', (await t.row(target.r.id)).adoptReason)
  check('S6 委譲された購買の再選定は例外閾値超でも PM 承認不要・理由「納期」', !/PM承認待ち/.test(await t.cell(target.r.id, 'status')) && (await t.row(target.r.id)).adoptReason === '納期', `${await t.cell(target.r.id, 'status')} reason=${(await t.row(target.r.id)).adoptReason}`)
}
// 変更セット PM 承認 ON
await t.role('pm'); await t.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await t.press('Enter'); await page.waitForTimeout(100)
for (let i = 0; i < 6; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await page.getByTestId('prompt-text').fill('承認制に'); await t.press('Enter'); await page.waitForTimeout(80)
log('changeNeedsPmApproval:', (await t.proj()).settings.changeNeedsPmApproval)
await t.role('design'); await t.setCell('R040', '必要数', '7'); await t.press('Control+Enter'); await page.waitForTimeout(80); await t.press('1'); await page.waitForTimeout(150)
log('design publish →', (await t.status()).match(/公開[^E]*/)?.[0], 'R040:', JSON.stringify((await t.row('R040')).flags), (await t.row('R040')).qtyNeeded)
await t.role('purchasing'); log('purchasing sees R040 qty:', await t.cell('R040', 'qtyNeeded'), 'status:', await t.cell('R040', 'status'))
check('S6 承認待ちの変更は購買に値が見えない（「承認待ちの変更あり」だけ）', (await t.cell('R040', 'qtyNeeded')) !== '7', await t.cell('R040', 'qtyNeeded'))
await t.role('pm'); await t.press('7'); await t.goto('R040'); await t.press('Enter'); log('panel:', await page.getByTestId('quickfix').textContent()); await t.press('Shift+Y'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('却下'); await t.press('Enter'); await page.waitForTimeout(80)
const r40 = await t.row('R040'); log('却下 →', await t.toast(), 'qty', r40.qtyNeeded, 'working', JSON.stringify(r40.working), 'revoked:', (await t.proj()).submissions.map((s) => s.rev + ':' + !!s.revoked))
check('S6 変更セット却下 → 公開を取り消し作業中に戻す', r40.qtyNeeded !== 7 && r40.working?.qtyNeeded === 7)
await t.role('design'); log('design sees R040:', await t.cell('R040', 'qtyNeeded'), await t.cell('R040', 'status'), 'bar:', (await t.status()).match(/未公開 \d+ 行/)?.[0])
log('ERRORS:', t.errors)
await t.close()
