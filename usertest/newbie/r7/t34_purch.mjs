// 購買の新人: 概算依頼 → 6 で打つ → 取り込み → 設計の採用 → 正式依頼 → 8 で打つ → 発注
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, row, runPalette, setRole, sleep, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t34_purch')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const st = (id) => row(page, id).then((r) => r && `${r.id}:${r.status}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}${r.orderQty != null ? ' oq=' + r.orderQty : ''}${r.ordered ? ' ordered' : ''}${r.working ? '*' + JSON.stringify(r.working) : ''} name=${r.name}`)
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}${x.formalPrice != null ? ' F' + x.formalPrice + '/' + x.formalLeadDays : ''}`).join(' ')
const toCol = async (re) => { for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (re.test(c)) return true; await page.keyboard.press('ArrowRight') } return false }
await fresh(page)
await step('設計が公開', async () => {
  await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('2'); await sleep(100); await page.keyboard.press('Enter'); await sleep(150); log('  ', await T.toast(page), await st('R076'))
})
await step('購買: 概算見積を依頼', async () => {
  await setRole(page, 'purchasing'); await sleep(100); await state('purch open')
  await runPalette(page, '概算見積を依頼'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 300))
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(200); log('  Enter ->', (await T.panelText(page))?.slice(0, 200), '|', await T.toast(page)) }
  log('  R076', await st('R076'))
})
await step('6 商社別: 単価セルで数字をいきなり / Enter から', async () => {
  await page.keyboard.press('6'); await sleep(200); await state('6')
  await sel(page, 'R076'); await toCol(/単価/); await state('at 単価')
  await typeReal(page, '1200', 120); await state('typed 1200 w/o Enter')
  await page.keyboard.press('6'); await sel(page, 'R076'); await toCol(/単価/)
  await typeReal(page, 'abc', 60); await state('typed abc on price'); await page.keyboard.press('Enter'); await sleep(120); await state('Enter'); log('  R076 quotes', await quotes('R076'))
  await page.keyboard.press('Escape'); await sel(page, 'R076'); await toCol(/単価/)
  await page.keyboard.press('Enter'); await typeReal(page, '1200'); await page.keyboard.press('Tab'); await typeReal(page, '14'); await page.keyboard.press('Tab'); await typeReal(page, '1'); await page.keyboard.press('Enter'); await sleep(100)
  await typeReal(page, '800'); await page.keyboard.press('Tab'); await typeReal(page, '7'); await page.keyboard.press('Tab'); await typeReal(page, '10'); await page.keyboard.press('Enter'); await sleep(100)
  await state('after 2 rows'); log('  R076', await quotes('R076'), '| R077', await quotes('R077'))
  await page.keyboard.press('Escape'); await sleep(80); await state('Esc')
})
await step('見積回答を取り込む（貼り付け）', async () => {
  await clearToast(page)
  await runPalette(page, '見積回答を取り込む'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 300))
  for (let i = 0; i < 2 && (await T.panel(page)) && !(await page.locator('.overlay textarea').count()); i++) { await page.keyboard.press('Enter'); await sleep(120); log('  Enter ->', (await T.panelText(page))?.slice(0, 200)) }
  const p = await proj(page); const m = (id) => p.rows.find((r) => r.id === id).model
  const tsv = ['見積書 No.123', '', `行ID\t型式\t単価\t納期\tMOQ`, `R078\t${m('R078')}\t3,500\t2週間\t1`, `R079\t${m('R079')}\t#VALUE!\t5\t1`, `R080\t${m('R080')}\t900円\t3日\t1`, `\t合計\t4400\t\t`].join('\n')
  if (await page.locator('.overlay textarea').count()) { await page.locator('.overlay textarea').fill(tsv); await page.keyboard.press('Control+Enter'); await sleep(200) }
  log('  toast', await T.toast(page), '| panel', (await T.panelText(page))?.slice(0, 300))
  for (const id of ['R078', 'R079', 'R080']) log('   ', id, await quotes(id))
  await shot(page, 't34_import')
  if (await T.panel(page)) await page.keyboard.press('Escape')
})
await step('設計: 採用（Ctrl+Alt+A / ID 列で a / 部品名で a）', async () => {
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '部品名'); await state('R030 部品名')
  await page.keyboard.press('Control+Alt+a'); await sleep(150); log('  Ctrl+Alt+A', await T.toast(page), await st('R030'))
  await sel(page, 'R031'); await page.keyboard.press('Home'); await page.keyboard.press('a'); await sleep(150); log('  ID a', await T.toast(page), await st('R031'))
  await sel(page, 'R032'); await gotoCol(page, '部品名'); await page.keyboard.press('a'); await sleep(80); await state('部品名 a'); await page.keyboard.press('Enter'); await sleep(100); log('  部品名 a Enter', await T.toast(page), await st('R032'))
  await page.keyboard.press('Control+z'); await sleep(100); log('  Ctrl+Z', await T.toast(page), await st('R032'))
})
await step('購買: 正式見積を依頼 → 8 で入力', async () => {
  await setRole(page, 'purchasing'); await runPalette(page, '正式見積を依頼'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 300))
  await page.keyboard.press('Enter'); await sleep(150); log('  Enter(default) ->', await T.panel(page), await T.toast(page))
  await runPalette(page, '正式見積を依頼'); await page.keyboard.press('2'); await sleep(200)
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('  panel', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Enter'); await sleep(300) }
  log('  toast', await T.toast(page), await st('R030'), await st('R031'))
  await page.keyboard.press('8'); await sleep(200); await state('8'); await shot(page, 't34_view8')
  await sel(page, 'R030'); await toCol(/正式単価/); await state('at 正式単価')
  await page.keyboard.press('Enter'); await typeReal(page, '19000'); await page.keyboard.press('Tab'); await typeReal(page, '20'); await page.keyboard.press('Enter'); await sleep(150); await state('after row1')
  await typeReal(page, '36000'); await page.keyboard.press('Tab'); await typeReal(page, '12'); await page.keyboard.press('Enter'); await sleep(150); await state('after row2')
  log('  R030', await st('R030'), await quotes('R030')); log('  R031', await st('R031'), await quotes('R031'))
  await page.keyboard.press('Escape')
})
await step('発注（3 発注・入荷）: 発注数で o / ID で o / Alt+o', async () => {
  await page.keyboard.press('3'); await sleep(150); await sel(page, 'R030'); await state('3 R030')
  await toCol(/発注数/); await state('at 発注数')
  await page.keyboard.press('o'); await sleep(100); await state('o on 発注数'); await page.keyboard.press('Escape')
  await page.keyboard.press('Alt+o'); await sleep(150); await state('Alt+o'); log('  ', await st('R030'))
  await page.keyboard.press('Control+z'); await sleep(100); log('  Ctrl+Z', await T.toast(page), await st('R030'))
})
save(errors); await browser.close()
