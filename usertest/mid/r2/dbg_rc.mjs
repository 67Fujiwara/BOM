import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design'); await t.press('1')
await t.goto('R022'); await t.colKey('model'); await t.press('Control+.'); await t.press('1'); await page.waitForTimeout(100)
if ((await page.getByTestId('mode').textContent()) === '編集') await t.press('Escape')
await t.goto('R016'); await t.colKey('model'); await t.press('x')
await t.press('Control+Enter'); await page.waitForTimeout(80); let d = await t.dialog(); if (/Rev/.test(d)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('pub', await t.toast())
const p = await t.proj(); const nr = p.rows.find((r) => r.replaces === 'R022'); log('nr', nr.id, nr.status, JSON.stringify(nr.flags))
await t.role('purchasing'); await t.press('1'); await t.goto(nr.id); log('cursor', await t.cursor())
await t.press('Control+.'); await page.waitForTimeout(80)
log('qf count', await page.getByTestId('quickfix').count(), 'toast:', await t.toast())
await t.press(' '); await page.waitForTimeout(60); await t.press('ArrowDown'); await page.waitForTimeout(40); log('status:', (await t.status()).slice(0, 100)); await t.press('Enter'); await page.waitForTimeout(80)
log('panel:', await page.getByTestId('quickfix').textContent().catch(() => 'none'), 'toast:', await t.toast())
await t.close()
