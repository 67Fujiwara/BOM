// 流れ: 設計が公開 → 購買が概算見積依頼・回答取込 → 設計が採用 → 購買が正式見積 → PM が決定
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, proj, ui, palette, runPalette, setRole, clearToast } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog('t06_flow')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const panelLoop = async (label, keys) => { for (const k of keys) { const pt = await T.panelText(page); log(`  [${label}] panel: ${pt?.slice(0, 200)}`); if (!pt) break; await page.keyboard.press(k); await page.waitForTimeout(120) } log(`  [${label}] toast: ${await T.toast(page)}`) }
const st = (id) => row(page, id).then((r) => r && `${r.id}:${r.status}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}${r.working ? '*' + JSON.stringify(r.working) : ''} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}`)

await fresh(page)
await step('design publish', async () => {
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  await panelLoop('publish', ['Enter', '2', 'Enter', 'Enter'])
  log('R076', await st('R076'), 'R080', await st('R080'))
})
await step('purchasing request', async () => {
  await setRole(page, 'purchasing')
  log('purch view', (await ui(page)).view, 'rows', await T.rows(page), 'header', (await T.header(page)).replace(/\s+/g, ' ').slice(0, 200))
  await runPalette(page, '概算見積を依頼'); log('  request prompt', await T.panelText(page))
  await page.getByTestId('prompt-text').fill('来週'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  log('  "来週" -> panel', await T.panel(page), 'text', await page.getByTestId('prompt-text').inputValue().catch(() => '-'), 'toast', await T.toast(page))
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await runPalette(page, '概算見積を依頼')
  const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null)
  await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  const d = await dl
  log('  Enter (default) -> toast', await T.toast(page), 'download', d?.suggestedFilename() ?? 'none', '| R076', await st('R076'))
})
await step('purchasing import', async () => {
  await clearToast(page)
  await runPalette(page, '見積回答を取り込む'); log('  import prompt', await T.panelText(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  import panel', await T.panelText(page))
  const p = await proj(page)
  const m = (id) => p.rows.find((r) => r.id === id).model
  const tsv = [`行ID\t型式\t単価\t納期\tMOQ`, `R076\t${m('R076')}\t1200\t14\t1`, `R077\t${m('R077')}\tabc\t7\t1`, `R078\t${m('R078')}\t¥3,500\t2週間\t`, `R079\t${m('R079')}\t-50\t5\t1`, `R080\tWRONG-MODEL\t900\t3\t1`, `R999\tX\t1\t1\t1`].join('\n')
  await page.locator('.overlay textarea').fill(tsv)
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150)
  log('  import result toast:', await T.toast(page))
  for (const id of ['R076', 'R077', 'R078', 'R079', 'R080']) { const q = (await proj(page)).quotes.filter((x) => x.rowId === id && x.supplierId === 'S1').map((x) => `${x.unitPrice}/${x.leadDays}/${x.moq}`); log('   ', await st(id), 'S1 quote', q.join(',')) }
  await shot(page, 't06_import_result')
})
await step('purchasing 1 by 1 quote entry in 6', async () => {
  await page.keyboard.press('6'); await page.waitForTimeout(100)
  log('  view6 cols', (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  await sel(page, 'R076'); log('  cursor', await T.cursor(page))
  // Excel 風: 単価 → Tab → 納期 → Tab → MOQ → Enter
  for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
  log('  cursor at', await T.cursor(page))
  await page.keyboard.type('1500'); await page.keyboard.press('Tab'); await page.keyboard.type('10'); await page.keyboard.press('Tab'); await page.keyboard.type('5'); await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  log('  after typing: cursor', await T.cursor(page), 'view', (await ui(page)).view, 'toast', await T.toast(page))
  const q = (await proj(page)).quotes.filter((x) => x.rowId === 'R076').map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}`); log('  R076 quotes', q.join(' '))
  await shot(page, 't06_view6_typing')
})
await step('design adopt with a', async () => {
  await setRole(page, 'design'); log('  design view', (await ui(page)).view, 'rows', await T.rows(page))
  await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('a'); await page.waitForTimeout(100)
  log('  a on R030 ->', await T.toast(page), await T.panelText(page), await st('R030'))
  await sel(page, 'R031'); await page.keyboard.press('Shift+A'); await page.waitForTimeout(80); log('  Shift+A R031', await T.panelText(page))
  await page.keyboard.press('2'); await page.waitForTimeout(80); log('  2 ->', await T.panelText(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', await T.panelText(page), await T.toast(page))
  await page.keyboard.press('1'); await page.waitForTimeout(80); log('  1 ->', await T.panelText(page), await T.toast(page), await st('R031'))
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80); log('  Ctrl+Z ->', await T.toast(page), await st('R031'))
  await page.keyboard.press('Control+y'); await page.waitForTimeout(80); log('  Ctrl+Y ->', await T.toast(page), await st('R031'))
})
await step('purchasing formal', async () => {
  await setRole(page, 'purchasing')
  await runPalette(page, '正式見積を依頼'); log('  formal confirm', await T.panelText(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); log('  Enter (default) ->', await T.panel(page), await T.toast(page), await st('R030'))
  await runPalette(page, '正式見積を依頼'); await page.keyboard.press('2'); await page.waitForTimeout(400); log('  2 ->', await T.panel(page), await T.toast(page), await st('R030'), await st('R001'))
  if (await T.panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(400); log('  ↓Enter ->', await T.panel(page), await T.toast(page), await st('R030')) }
  await page.keyboard.press('8'); await page.waitForTimeout(100); log('  view8 rows', await T.rows(page), (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  await sel(page, 'R030'); for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/正式単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
  log('  cursor', await T.cursor(page))
  await page.keyboard.type('25000'); await page.keyboard.press('Tab'); await page.keyboard.type('20'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  log('  formal typed ->', await T.toast(page), await st('R030'))
  await shot(page, 't06_view8')
})
await step('pm decide', async () => {
  await setRole(page, 'pm'); log('  pm view', (await ui(page)).view, 'rows', await T.rows(page), await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((tr) => tr.dataset.rowId).join(',')))
  await sel(page, 'R030'); log('  status hints', await T.hints(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page))
  await page.keyboard.press('g'); await page.waitForTimeout(100); log('  g ->', await T.panelText(page), await T.toast(page))
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), await T.toast(page)) }
  if (await T.panel(page)) { await page.keyboard.type('値下げ交渉'); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  type+Enter ->', await T.panelText(page), await T.toast(page)) }
  log('  R030 after', await st('R030'))
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); log('  Ctrl+Z', await T.toast(page), await st('R030'))
  await shot(page, 't06_pm')
})
save(errors)
await browser.close()
