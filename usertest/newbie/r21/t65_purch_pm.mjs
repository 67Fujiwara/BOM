// ラウンド8: 購買の見積入力（6・8 で Enter → 打ち直し、在庫・有効期限）、採用、PM の決定（7）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, diff, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t65_purch_pm')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const quotes = async (id) => { const p = await proj(page); return p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => `${q.supplierId}:${q.unitPrice}/${q.leadDays}/${q.moq}/${q.stock ?? ''}/${q.validUntil ?? ''}${q.formalPrice != null ? ` F${q.formalPrice}/${q.formalLeadDays}` : ''}`).join(' ') }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const toColRe = async (re, max = 40) => { await page.keyboard.press('Home'); for (let i = 0; i < max; i++) { const c = await T.cursor(page); if (re.test(c)) return c; await page.keyboard.press('ArrowRight') } return null }

await step('A. 購買 6: R033 因幡電機 の単価・納期・MOQ・在庫・有効期限を Enter → 打ち直し → Tab', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('6'); await sleep(150)
  await sel(page, 'R033'); log('  col', await toColRe(/単価/)); log('  before', await quotes('R033'))
  const vals = ['98', '10', '5', 'z', '2026/12/31']
  for (const v of vals) {
    await page.keyboard.press('Enter'); await sleep(50); const u = await ui(page); log(`   ${u.cursorCol} Enter -> edit=${JSON.stringify(u.editValue)}`)
    await typeReal(page, v, 30); await sleep(40); log(`     typed ${v} -> edit=${JSON.stringify((await ui(page)).editValue)}`)
    await page.keyboard.press('Tab'); await sleep(80); log(`     Tab -> ${await T.toast(page)} | mode ${(await ui(page)).mode}`)
    if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await page.keyboard.press('ArrowRight') }
  }
  log('  after', await quotes('R033'))
})
await step('B. 購買 6: いきなり打つ（単価 1,200 円・納期 2週間・在庫 在庫あり・有効期限 12/31）', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('6'); await sleep(150)
  await sel(page, 'R034'); await toColRe(/単価/); log('  before', await quotes('R034'))
  for (const v of ['1,200円', '2週間', '1']) { await typeReal(page, v.replace(/[^\x20-\x7e]/g, ''), 30); if (/[^\x20-\x7e]/.test(v)) await page.keyboard.insertText(v.replace(/[\x20-\x7e]/g, '')); await page.keyboard.press('Tab'); await sleep(80); log(`   ${v} -> ${await T.toast(page)} | mode ${(await ui(page)).mode} edit=${JSON.stringify((await ui(page)).editValue)}`); if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await page.keyboard.press('ArrowRight') } }
  await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.insertText('在庫あり'); await page.keyboard.press('Tab'); await sleep(80); log(`   在庫あり -> ${await T.toast(page)} | mode ${(await ui(page)).mode} edit=${JSON.stringify((await ui(page)).editValue)}`); if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await page.keyboard.press('ArrowRight') }
  await typeReal(page, '12/31', 30); await page.keyboard.press('Enter'); await sleep(80); log(`   12/31 -> ${await T.toast(page)}`)
  log('  after', await quotes('R034'))
})
await step('C. 購買 8: 正式単価を Enter → 打ち直し（期待: 上書き）', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('8'); await sleep(150)
  const ids = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('  rows', ids.join(','))
  await sel(page, ids.find((x) => x !== 'R001') ?? ids[0]); const c = await toColRe(/正式単価/); log('  col', c)
  const id = (await ui(page)).cursorRow; log('  before', id, await quotes(id))
  await page.keyboard.press('Enter'); await sleep(50); await state('Enter'); await typeReal(page, '1500', 30); await page.keyboard.press('Enter'); await sleep(100); await state('typed 1500 Enter')
  log('  after', await quotes(id))
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await sleep(50); await state('Enter again'); await typeReal(page, '1450', 30); await page.keyboard.press('Enter'); await sleep(100)
  log('  after2', await quotes(id))
})
await step('D. 購買 8: 単価（自動計算）の列に 1500 を打つ（隣の列と間違えた）', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('8'); await sleep(150)
  const ids = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
  await sel(page, ids[1]); const c = await toColRe(/ 単価$/); log('  col', c); await state('at 単価')
  for (const k of ['1', '5', '0', '0']) { await page.keyboard.press(k); await sleep(80); const u = await ui(page); log(`   ${k}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} toast=${await T.toast(page)}`) }
  await page.keyboard.press('Enter'); await sleep(100); await state('Enter')
  await shot(page, 't65_D_wrong_col_digits')
})
await step('E. PM 7: Enter → 決定パネル → p（委譲）→ Enter / Esc / Ctrl+K', async () => {
  await fresh(page, 'pm'); await sleep(150); const p0 = await proj(page)
  await page.keyboard.press('Enter'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 250))
  await page.keyboard.press('p'); await sleep(100); await state('p'); log('  panel', (await T.panelText(page))?.slice(0, 250))
  await page.keyboard.press('Control+k'); await sleep(100); await state('Ctrl+K in p dialog')
  if ((await ui(page)).panel === 'palette') await page.keyboard.press('Escape')
  await sleep(80); await state('after')
  if ((await ui(page)).panel) { await page.keyboard.press('Enter'); await sleep(150); await state('Enter') }
  const p1 = await proj(page); log('  decisions', JSON.stringify((p1.decisions ?? []).map((d) => [d.kind, d.reason])), '| R003 flags', JSON.stringify(p1.rows.find((r) => r.id === 'R003').flags))
  await page.keyboard.press('Control+z'); await sleep(100); await state('Ctrl+Z'); const p2 = await proj(page); log('  decisions after undo', (p2.decisions ?? []).length, JSON.stringify(p2.rows.find((r) => r.id === 'R003').flags))
})
await step('F. PM 7: e（特急・分納の上限）→ 打つ「5万」→ Enter', async () => {
  await fresh(page, 'pm'); await sleep(150)
  await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press('e'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 250))
  await page.keyboard.insertText('5万'); await page.keyboard.press('Enter'); await sleep(150); await state('5万 Enter'); log('  panel', (await T.panelText(page))?.slice(0, 200))
  if ((await ui(page)).panel) { await page.keyboard.press('Control+a'); await typeReal(page, '50000', 20); await page.keyboard.press('Enter'); await sleep(150); await state('50000 Enter') }
  const p1 = await proj(page); log('  decisions', JSON.stringify((p1.decisions ?? []).map((d) => [d.kind, JSON.stringify(d.payload ?? {}).slice(0, 80)])))
})
save(errors); await browser.close()
