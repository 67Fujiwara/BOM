import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('pm')
await t.press('7'); await t.goto('R013'); log('R013 (差分超過 +15%, 上長決裁は予算超過で該当):', await t.cell('R013', 'status'))
// q 数量見直し依頼
await t.press('Enter'); await t.press('q'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('数量を減らせますか'); await t.press('Enter'); await page.waitForTimeout(80)
let p = await t.proj(); log('q →', await t.toast(), 'issues:', p.issues.filter((i) => i.rowId === 'R013').map((i) => i.kind + ':' + i.status), 'flags:', JSON.stringify(p.rows.find((r) => r.id === 'R013').flags))
await t.press('1'); log('R013 ball after q:', await t.cell('R013', 'ball'))
check('DBG 差分超過の q → 数量見直し依頼が起票され設計のボール（差分超過が外れる）', (await t.cell('R013', 'ball')) === '設計', await t.cell('R013', 'ball'))
// y 受入 with external approval
await t.press('7'); await t.goto('R013'); await t.press('y'); await page.waitForTimeout(50)
if (await page.getByTestId('extra-承認者').count()) { await page.getByTestId('extra-承認者').fill('部長'); await page.getByTestId('extra-決裁書No').fill('K-100'); await page.getByTestId('prompt-text').fill('為替なので受入'); await t.press('Enter'); await page.waitForTimeout(80) }
p = await t.proj(); log('y →', await t.toast(), 'flags:', JSON.stringify(p.rows.find((r) => r.id === 'R013').flags), 'decision:', JSON.stringify(p.decisions.at(-1)?.external))
check('DBG 上長決裁を入れて受入 → 差分超過が外れる', !p.rows.find((r) => r.id === 'R013').flags.formalDiff)
log('PM 7 count:', await t.viewCount(7))
log('ERRORS:', t.errors)
await t.close()
