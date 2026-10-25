// Excel の癖: 1 行目 単価 Tab 納期 Tab MOQ Enter → 2 行目も 単価 Tab 納期 Tab MOQ Enter（Excel は Enter で行頭の列へ戻る）
import { launch, fresh, T, makeLog, shot, sel, row, proj, ui, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t10_excel_rows')
const q = async (id, s = 'S1') => { const x = (await proj(page)).quotes.find((y) => y.rowId === id && y.supplierId === s); return x ? `単価${x.unitPrice}/納期${x.leadDays}/MOQ${x.moq} 正式${x.formalPrice}/${x.formalLeadDays}` : '-' }
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`) }
await fresh(page)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'purchasing'); await runPalette(page, '概算見積を依頼'); await page.keyboard.press('Enter'); await page.waitForTimeout(200)
await page.keyboard.press('6'); await sel(page, 'R076'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
await page.keyboard.press('Enter')
const data = [['1200', '14', '1'], ['800', '7', '10'], ['450', '3', '100']]
for (const [p, l, m] of data) { await page.keyboard.type(p); await page.keyboard.press('Tab'); await page.keyboard.type(l); await page.keyboard.press('Tab'); await page.keyboard.type(m); await page.keyboard.press('Enter'); await page.waitForTimeout(60); await U(`typed ${p} Tab ${l} Tab ${m} Enter`) }
for (const id of ['R076', 'R077', 'R078', 'R079', 'R080']) log(' ', id, await q(id))
await shot(page, 't10_view6_rows')
// 8 でも同じ
await page.keyboard.press('Escape')
await setRole(page, 'design'); await page.keyboard.press('1'); for (const id of ['R030', 'R031', 'R032']) { await sel(page, id); await page.keyboard.press('a'); await page.waitForTimeout(60) }
await setRole(page, 'purchasing'); await runPalette(page, '正式見積を依頼'); await page.keyboard.press('2'); await page.waitForTimeout(150); for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(300) }
await page.keyboard.press('8'); await sel(page, 'R030'); for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/正式単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
await page.keyboard.press('Enter')
for (const [p, l] of [['20000', '20'], ['140', '15'], ['300', '10']]) { await page.keyboard.type(p); await page.keyboard.press('Tab'); await page.keyboard.type(l); await page.keyboard.press('Enter'); await page.waitForTimeout(60); await U(`8 typed ${p} Tab ${l} Enter`) }
const p = await proj(page)
for (const id of ['R030', 'R031', 'R032', 'R033']) { const r = p.rows.find((x) => x.id === id); log(' ', id, r.status, r.adoptedSupplierId, await q(id, r.adoptedSupplierId || 'S1')) }
await shot(page, 't10_view8_rows')
save(errors); await browser.close()
