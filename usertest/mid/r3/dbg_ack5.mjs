import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); await t.setCellKey('R026', 'note', '変更')
await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
await t.role('purchasing'); await t.press('5'); await t.goto('R026'); log('cur', await t.curRow(), 'status hint', (await t.status()).slice(0, 80)); await t.press('x'); await page.waitForTimeout(80); log('x →', await t.toast())
let p = await t.proj(); log('acked', p.submissions.map((s) => s.rev + ':' + s.acked.includes('R026')))
await t.role('pm'); await t.press('5'); log('PM 5 has R026', (await t.viewRows()).includes('R026'))
await t.role('design'); await t.press('5'); log('design 5 has R026', (await t.viewRows()).includes('R026'))
await t.close()
