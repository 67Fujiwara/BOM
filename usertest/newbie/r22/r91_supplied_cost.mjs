// ラウンド22: 支給品に替えた行の金額・見積済の分母・採用商社の表示
import { launch, fresh, T, makeLog, proj, sleep, sel, gotoCol } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r91_supplied_cost')
await fresh(page, 'design')
const hd = async () => (await page.getByTestId('header').textContent()).replace(/\s+/g, ' ').replace(/^.*?(概算)/, '$1').slice(0, 200)
const row = async (id) => (await T.rowText(page, id))
log('before header: ' + await hd()); log('R001 row: ' + await row('R001'))
await sel(page, 'R001'); await gotoCol(page, '調達区分'); await page.keyboard.press('Enter'); await page.keyboard.insertText('支給'); await page.keyboard.press('Enter'); await sleep(250)
log('working header: ' + await hd()); log('R001 row: ' + await row('R001'))
await page.keyboard.press('Control+Enter'); await sleep(300); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(400)
log('toast ' + await T.toast(page))
log('published header: ' + await hd()); log('R001 row: ' + await row('R001'))
const p = await proj(page); const r = p.rows.find((x) => x.id === 'R001'); log('R001 adopted=' + r.adoptedSupplierId + ' status=' + r.status + ' quotes=' + p.quotes.filter((q) => q.rowId === 'R001' && !q.stale).length)
// 購買: 5 見積 のビューで R001 は？
await page.getByTestId('role-purchasing').click(); await sleep(200)
await page.keyboard.press('Alt+5'); await sleep(250)
log('purchasing 5: R001 row: ' + await row('R001'))
await page.keyboard.press('Alt+1'); await sleep(250); log('purchasing 1: R001 row: ' + await row('R001'))
await page.keyboard.press('Alt+9'); await sleep(250); log('purchasing 9 count ' + await T.rows(page))
// 設計に戻して調達区分を相見積に戻す
await page.getByTestId('role-design').click(); await sleep(200)
await sel(page, 'R001'); await gotoCol(page, '調達区分'); await page.keyboard.press('Enter'); await page.keyboard.insertText('相見'); await page.keyboard.press('Enter'); await sleep(250)
await page.keyboard.press('Control+Enter'); await sleep(300); if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(400) }
log('revert toast ' + await T.toast(page)); const p2 = await proj(page); const r2 = p2.rows.find((x) => x.id === 'R001'); log('R001 after revert: proc=' + r2.procurement + ' adopted=' + r2.adoptedSupplierId + ' status=' + r2.status + ' flags=' + JSON.stringify(r2.flags))
log('header: ' + await hd())
save(errors); await browser.close()
