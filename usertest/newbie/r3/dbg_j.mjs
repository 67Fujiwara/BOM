import { launch, fresh, T, sel, gotoCol, row, ui, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page); await page.keyboard.press('1'); await sel(page, 'R079'); await gotoCol(page, '型式')
await page.evaluate(() => navigator.clipboard.writeText('AAA-1\tメーカA\t5\nBBB-2\tメーカB\t6\nCCC-3\tメーカC\t7\nDDD-4\tメーカD\t8'))
const n0 = (await proj(page)).rows.length
await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
console.log('paste 4 rows at R079 (2 rows left) ->', await T.toast(page), 'rows', n0, '->', (await proj(page)).rows.length)
for (const id of ['R079', 'R080', 'R081', 'R082']) { const r = await row(page, id); console.log('  ', id, r ? JSON.stringify({ name: r.name, model: r.model, maker: r.maker, qty: r.qtyNeeded, w: r.working }) : '(なし)') }
// 読み取り専用列（状態・単価）から始まる貼り付け
await sel(page, 'R040'); await gotoCol(page, 'メーカ')
await page.evaluate(() => navigator.clipboard.writeText('X社\t3\t個\t相見積\t推奨\t同等品可\textra1\textra2\textra3'))
await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
console.log('paste wide row at R040 メーカ ->', await T.toast(page), JSON.stringify((await row(page, 'R040')).working))
// 購買が設計列に貼る
await page.locator('[data-testid=role-purchasing]').click(); await page.keyboard.press('1'); await sel(page, 'R041'); await gotoCol(page, '型式')
await page.evaluate(() => navigator.clipboard.writeText('ZZZ'))
await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
console.log('purchasing paste into 型式 ->', await T.toast(page), (await row(page, 'R041')).model)
await browser.close(); console.log(errors)
