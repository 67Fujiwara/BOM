import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design'); await t.press('1')
await t.goto('R047'); await t.press('Shift+A'); await t.press('2'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50)
log('R047 before:', JSON.stringify(await t.row('R047').then((r) => ({ s: r.status, a: r.adoptedSupplierId, f: r.flags }))))
const m0 = await t.money()
await t.cmd('商社を集約'); await page.waitForTimeout(100)
const opts = await page.locator('[data-testid="panel-consolidate"] .opt').allTextContents().catch(() => [])
log('opts', (await t.dialog()).slice(0, 400))
// 2 番目（2社・全行カバー）を選ぶ
await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150)
log('→', await t.toast(), '| money', m0, '→', await t.money())
log('R047 after:', JSON.stringify(await t.row('R047').then((r) => ({ s: r.status, a: r.adoptedSupplierId, reason: r.adoptReason, f: r.flags }))))
const d = (await t.proj()).decisions.filter((x) => x.rowId === 'R047'); log('decisions R047', d.length)
await t.close()
