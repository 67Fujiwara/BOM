// 新人の雑多な操作: 編集中のクリック、Enter 連打、編集中のリロード、Undo/Redo とリロード、? と Ctrl+K
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, typeReal, diff, sleep, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t25_misc5')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snapshot = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push('NEW ' + r.id); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
const vis = () => page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId))
await step('click another row while editing', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '部品名')
  const r0 = await snapshot()
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await typeReal(page, 'Relay 24V', 300)
  const ids = await vis(); const tgt = ids[ids.indexOf('R030') + 3]
  await page.locator(`[data-row-id="${tgt}"] td.model, [data-row-id="${tgt}"] td`).nth(5).click(); await sleep(300)
  const u = await ui(page); log(`  clicked ${tgt}: mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} toast=${await T.toast(page)}`)
  log('  changes', await changes(r0))
  // クリックした先でそのまま打つ
  await typeReal(page, 'MY2N', 300); await page.keyboard.press('Enter'); await sleep(200)
  log('  after typing MY2N Enter on clicked cell', await changes(r0))
})
await step('Enter x12 in nav (design)', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R040')
  for (const col of ['部品名', '単位', '調達区分', 'メーカ指定', '代替可否', '必要日(前倒し)', '必要日(固定)']) {
    await sel(page, 'R040'); const ok = await gotoCol(page, col); const r0 = await snapshot()
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await sleep(120) }
    if ((await ui(page)).mode === 'edit') await page.keyboard.press('Escape')
    log(`  ${col}(${ok}) Enter x12 -> cur=${(await ui(page)).cursorRow} changes: ${await changes(r0)}`)
  }
})
await step('Enter x12 in nav (purchasing 3 / 9)', async () => {
  await fresh(page, 'purchasing')
  for (const [v, col] of [[3, '入荷予定'], [3, 'ロット'], [3, '発注数'], [9, '発注数']]) {
    await page.keyboard.press(String(v)); await sleep(150); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown'); const ok = await gotoCol(page, col); const r0 = await snapshot()
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await sleep(120) }
    if ((await ui(page)).mode === 'edit') await page.keyboard.press('Escape')
    log(`  view${v} ${col}(${ok}) Enter x12 -> changes: ${await changes(r0)} toast=${await T.toast(page)}`)
  }
})
await step('reload while editing', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, '型式')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await typeReal(page, 'E3Z-D61 2M', 80)
  await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300)
  const r = await row(page, 'R031'); log('  after reload R031 model', r.model, 'working', JSON.stringify(r.working), 'toast', await T.toast(page))
  await page.locator('.gridwrap').focus().catch(() => {})
  await page.keyboard.press('Control+z'); await sleep(200); const r2 = await row(page, 'R031'); log('  Ctrl+Z ->', await T.toast(page), JSON.stringify(r2.working))
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus().catch(() => {}); await page.keyboard.press('Control+y'); await sleep(200); const r3 = await row(page, 'R031'); log('  reload, Ctrl+Y ->', await T.toast(page), JSON.stringify(r3.working))
})
await step('Ctrl+Z after Enter-type in other roles', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('3'); await sel(page, 'R013'); await gotoCol(page, 'ロット')
  await typeReal(page, 'L2026-1023', 300); await page.keyboard.press('Enter'); await sleep(200)
  log('  lot', (await row(page, 'R013')).receivedLot)
  await page.keyboard.press('Control+z'); await sleep(200); log('  Ctrl+Z ->', await T.toast(page), JSON.stringify((await row(page, 'R013')).receivedLot))
})
await step('help ?', async () => {
  await fresh(page); await page.keyboard.press('?'); await sleep(200); log('  ? ->', (await T.panelText(page))?.slice(0, 300))
  await page.keyboard.press('Escape'); await page.keyboard.press('Shift+Slash'); await sleep(200); log('  Shift+/ ->', await T.panel(page))
  await page.keyboard.press('Escape')
})
save(errors); await browser.close()
