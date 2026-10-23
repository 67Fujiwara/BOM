// 雑多な新人操作: 発注セルのダブルクリック、表への貼り付け、Undo と役割、Space/Enter 連打
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, runPalette, setRole } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog('t14_misc')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const st = async (id) => { const r = await row(page, id); return r && `${r.id}:${r.status}@${r.adoptedSupplierId ?? '-'} ordered=${r.ordered} received=${r.received} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}` }
await step('dblclick ordered', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('3'); await page.waitForTimeout(80)
  log('view3 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((tr) => tr.dataset.rowId).join(',')), 'cols', (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' '))
  for (const id of ['R013', 'R001']) {
    const cell = page.locator(`[data-row-id="${id}"] td[data-col="ordered"]`)
    if (!(await cell.count())) { log('no ordered cell for', id); continue }
    log(id, 'before', await st(id))
    await cell.dblclick(); await page.waitForTimeout(100)
    log(id, 'after dblclick 発注', await st(id), '| toast', await T.toast(page))
    await cell.click(); await page.waitForTimeout(80); log(id, 'after single click', await st(id))
  }
})
await step('paste grid', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R078'); await gotoCol(page, '型式')
  await page.evaluate(() => navigator.clipboard.writeText('AAA-1\tメーカA\t5\nBBB-2\tメーカB\tabc\nCCC-3\tメーカC\t7\nDDD-4\tメーカD\t8'))
  await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
  log('paste 4x3 at R078 型式 ->', await T.toast(page))
  for (const id of ['R078', 'R079', 'R080', 'R081']) { const r = await row(page, id); log('  ', id, r ? JSON.stringify({ model: r.model, maker: r.maker, qty: r.qtyNeeded, w: r.working }) : '(なし)') }
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80); log('  Ctrl+Z ->', await T.toast(page), JSON.stringify((await row(page, 'R078')).model))
  // 編集中に Ctrl+V（入力欄の貼り付けになるか）
  await sel(page, 'R077'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a')
  await page.evaluate(() => navigator.clipboard.writeText('PASTE-IN-EDIT'))
  await page.keyboard.press('Control+v'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
  log('Ctrl+V while editing R077 ->', JSON.stringify((await row(page, 'R077')).model))
  // 改行入り 1 セル
  await sel(page, 'R076'); await gotoCol(page, '部品名')
  await page.evaluate(() => navigator.clipboard.writeText('リレー\n'))
  await page.keyboard.press('Control+v'); await page.waitForTimeout(80); log('paste "リレー\\n" ->', await T.toast(page), JSON.stringify((await row(page, 'R076')).name), JSON.stringify((await row(page, 'R077')).name))
})
await step('undo role', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('DESIGNX'); await page.keyboard.press('Enter')
  await setRole(page, 'purchasing'); await page.keyboard.press('Control+z'); await page.waitForTimeout(80)
  log('purchasing Ctrl+Z after design edit ->', await T.toast(page), JSON.stringify((await row(page, 'R040')).working))
  await setRole(page, 'design'); await page.keyboard.press('Control+z'); await page.waitForTimeout(80)
  log('design Ctrl+Z ->', await T.toast(page), JSON.stringify((await row(page, 'R040')).working))
})
await step('enter spam', async () => {
  await fresh(page)
  const p0 = await proj(page)
  for (let i = 0; i < 15; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(30) }
  const p1 = await proj(page); const u = await ui(page)
  const ch = p1.rows.filter((r) => JSON.stringify(r) !== JSON.stringify(p0.rows.find((x) => x.id === r.id))).map((r) => r.id)
  log('Enter x15 on fresh (design view 4): mode', u.mode, 'cursor', u.cursorRow, u.cursorCol, 'panel', u.panel, 'changed rows', ch.join(','), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  for (let i = 0; i < 10; i++) { await page.keyboard.press(' '); await page.waitForTimeout(20) }
  log('Space x10: open rows', (await page.locator('tr.detail').count()))
  await setRole(page, 'pm'); for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(60) }
  log('PM Enter x6: panel', await T.panelText(page), 'toast', await T.toast(page), 'decisions', (await proj(page)).decisions.length, 'settings confirmed', (await proj(page)).settings.pmConfirmed)
  await page.keyboard.press('Escape')
  await setRole(page, 'purchasing'); for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(60) }
  const u2 = await ui(page); log('Purchasing Enter x6: mode', u2.mode, 'cursor', u2.cursorRow, u2.cursorCol, 'panel', u2.panel, 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
})
await step('ctrl+shift+f', async () => {
  await fresh(page); await page.keyboard.press('Control+Shift+F'); await page.waitForTimeout(100)
  log('Ctrl+Shift+F ->', await T.panelText(page), '|', await T.toast(page))
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); log('  Enter ->', (await T.panelText(page))?.slice(0, 150), '|', await T.toast(page)) }
  await page.keyboard.press('Escape')
})
save(errors)
await browser.close()
