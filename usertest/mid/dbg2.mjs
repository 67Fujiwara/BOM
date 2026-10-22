import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.setCell('R016', '型式', 'CP30-BA 2P 1-M 10A') // 指摘対応
await t.setCell('R044', '型式', 'KIV 1.25 黒 600V')     // 設計変更
await t.press('Control+Enter'); await page.waitForTimeout(100)
log('dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''))
await t.press('2'); await page.waitForTimeout(300)
log('after 2 dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''), 'toast:', await t.toast(), 'status:', await t.status())
let p = await t.proj()
log('submissions:', p.submissions.map((s) => `Rev${s.rev} ${s.rowIds.length} cs=${JSON.stringify(s.changeSet)} causes=${JSON.stringify(Object.fromEntries(Object.entries(s.causes).filter(([k]) => ['R016','R044'].includes(k))))}`))
log('R044 flags:', JSON.stringify(p.rows.find((r) => r.id === 'R044').flags), 'working:', JSON.stringify(p.rows.find((r) => r.id === 'R044').working))
log('ERRORS:', t.errors)
await t.close()
