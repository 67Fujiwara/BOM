import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.setCell('R013', '型式', 'S8VK-G12024 ')   // 警告（前後空白）
await t.setCell('R044', '型式', 'KIV 1.25 黒 600V') // 設計変更
await t.press('Control+Enter'); await page.waitForTimeout(100)
log('dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''))
await t.press('2')
for (const w of [0, 50, 200, 1000]) { await page.waitForTimeout(w); log(`toast after +${w}ms:`, JSON.stringify(await t.toast()), 'panel:', await page.locator('.overlay').count()) }
log('status:', await t.status())
log('ERRORS:', t.errors)
await t.close()
