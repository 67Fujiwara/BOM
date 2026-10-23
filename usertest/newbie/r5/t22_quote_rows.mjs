// N4-05 / U4-01 / U4-02 再検証と派生: 6・8 で Excel のように 単価 Tab 納期 Tab MOQ Enter を続ける（ゆっくり）。最後の行、途中のクリック
import { launch, fresh, T, makeLog, shot, sel, row, proj, ui, runPalette, setRole, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t22_quote_rows')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const st = (id) => row(page, id).then((r) => r && `${r.id}:${r.status}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}`)
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}${x.formalPrice != null ? ' F' + x.formalPrice + '/' + x.formalLeadDays : ''}`).join(' ')
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`) }
const slowType = async (s, d = 300) => { for (const ch of s) { await page.keyboard.press(ch); await sleep(d) } }
const toCol = async (re) => { for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (re.test(c)) return c; await page.keyboard.press('ArrowRight') } return null }
const visibleIds = () => page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId))
await fresh(page)
await step('setup', async () => {
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150)
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { log('  pub', (await T.panelText(page))?.slice(0, 120)); await page.keyboard.press(i === 0 ? '2' : 'Enter'); await page.waitForTimeout(150) }
  await setRole(page, 'purchasing'); await runPalette(page, '概算見積を依頼'); await page.keyboard.press('Enter'); await page.waitForTimeout(250)
  log('  request ->', await T.toast(page), await st('R076'))
})
await step('6 three rows slow', async () => {
  await page.keyboard.press('6'); await page.waitForTimeout(150)
  await sel(page, 'R076'); log('  col', await toCol(/単価/))
  await page.keyboard.press('Enter')
  for (const [p, l, m] of [['1200', '14', '1'], ['800', '7', '10'], ['450', '3', '100']]) {
    await slowType(p); await page.keyboard.press('Tab'); await sleep(300); await slowType(l); await page.keyboard.press('Tab'); await sleep(300); await slowType(m); await page.keyboard.press('Enter'); await sleep(300)
    await U(`${p} Tab ${l} Tab ${m} Enter`)
  }
  for (const id of ['R076', 'R077', 'R078', 'R079']) log('   ', id, await quotes(id))
  await shot(page, 't22_view6_rows')
  // U4-02: 自動で始まった空の入力で ↓ / Ctrl+Z
  await page.keyboard.press('ArrowDown'); await sleep(100); await U('ArrowDown in empty auto-edit')
  await page.keyboard.press('Control+z'); await sleep(150); await U('Ctrl+Z'); log('   R078', await quotes('R078'))
  await page.keyboard.press('Escape')
})
await step('6 last row', async () => {
  await page.keyboard.press('Control+ArrowDown'); await sleep(150); const ids = await visibleIds(); const last = (await ui(page)).cursorRow; log('  last row', last, 'visible tail', ids.slice(-3).join(','))
  await toCol(/単価/); const before = await quotes(last)
  await page.keyboard.press('Enter'); await slowType('333'); await page.keyboard.press('Tab'); await slowType('5'); await page.keyboard.press('Tab'); await slowType('2'); await page.keyboard.press('Enter'); await sleep(200)
  await U('last row 333 Tab 5 Tab 2 Enter')
  await slowType('777'); await page.keyboard.press('Enter'); await sleep(200); await U('then typed 777 Enter')
  log('   last', last, before, '->', await quotes(last))
  await page.keyboard.press('Escape')
})
await step('6 digits without Enter (U4-01)', async () => {
  await sel(page, 'R079'); await toCol(/単価/)
  const hits = []
  for (const ch of '1500') { await page.keyboard.press(ch); await sleep(350); const u = await ui(page); hits.push(`${ch}->view${u.view} toast=${await T.toast(page)}`) }
  log('  ', hits.join(' | '))
  await page.keyboard.press('6')
})
await step('click while editing', async () => {
  await page.keyboard.press('6'); await sel(page, 'R079'); await toCol(/単価/)
  await page.keyboard.press('Enter'); await slowType('2500')
  const ids = await visibleIds(); const target = ids[ids.indexOf('R079') + 2]
  await page.locator(`[data-row-id="${target}"] td`).nth(2).click(); await sleep(200)
  await U(`clicked ${target} while editing 2500`); log('   R079', await quotes('R079'))
  await page.keyboard.press('Escape')
})
await step('8 formal rows', async () => {
  await setRole(page, 'design'); await page.keyboard.press('1')
  for (const id of ['R030', 'R031', 'R032']) { await sel(page, id); await page.keyboard.press('a'); await sleep(500); log('  a', id, await T.toast(page), await st(id)) }
  await setRole(page, 'purchasing'); await runPalette(page, '正式見積を依頼'); log('  formal confirm', (await T.panelText(page))?.slice(0, 200))
  await page.keyboard.press('2'); await sleep(200); for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(300) }
  await page.keyboard.press('8'); await sleep(150); log('  8 rows', (await visibleIds()).join(','))
  await sel(page, 'R030'); log('  col', await toCol(/正式単価/))
  await page.keyboard.press('Enter')
  for (const [p, l] of [['20000', '20'], ['140', '15'], ['300', '10']]) { await slowType(p); await page.keyboard.press('Tab'); await sleep(300); await slowType(l); await page.keyboard.press('Enter'); await sleep(300); await U(`8 ${p} Tab ${l} Enter`) }
  for (const id of ['R030', 'R031', 'R032', 'R033']) log('   ', id, await st(id), await quotes(id))
  await shot(page, 't22_view8_rows')
})
save(errors); await browser.close()
