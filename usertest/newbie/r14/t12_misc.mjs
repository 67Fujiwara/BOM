// N3-08 順番に直すモード / N3-15 分類見出しの素早いクリック / U2-02 各パネルで Ctrl+K / U3-04 詳細見出し / n と Ctrl+.
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, ui, proj, palette, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t12_misc')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 120)} | toast=${await T.toast(page)}`) }
await step('N3-08', async () => {
  await fresh(page); await page.keyboard.press('Control+Shift+F'); await page.waitForTimeout(120); await U('seq start')
  await page.keyboard.press('1'); await page.waitForTimeout(150); await U('1 編集する')
  await page.keyboard.press('Control+a'); await page.keyboard.type('CP30-BA 2P 10A'); await U('typed')
  await page.keyboard.press('Enter'); await page.waitForTimeout(200); await U('Enter')
  log('  R016', JSON.stringify((await row(page, 'R016')).working))
  // 次の問題も Enter で受ける（新人は Enter 連打）
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); await U(`Enter#${i + 1}`) }
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await U('Esc Esc')
  const p = await proj(page); log('  working rows', p.rows.filter((r) => r.working).map((r) => r.id + JSON.stringify(r.working)).join(' '))
})
await step('n then Ctrl+.', async () => {
  await fresh(page); await page.keyboard.press('4'); await page.keyboard.press('n'); await U('n'); await page.keyboard.press('Control+.'); await page.waitForTimeout(100); await U('Ctrl+.')
  await page.keyboard.press('Enter'); await page.waitForTimeout(100); await U('Enter on quickfix')
  await page.keyboard.press('Escape'); await page.keyboard.press('n'); await page.keyboard.press('n'); await U('n n')
})
await step('N3-15', async () => {
  for (const delay of [0, 30, 120]) {
    await fresh(page); await page.keyboard.press('1')
    await sel(page, 'R032'); await page.locator('[data-row-id="R032"] td.name').dblclick()
    await page.keyboard.press('Control+a'); await page.keyboard.type('GROUPCLICK')
    const g = page.getByTestId('group-row').first(); await g.click({ delay }); await page.waitForTimeout(200)
    const r = await row(page, 'R032'); const u = await ui(page)
    log(`N3-15 delay ${delay}: mode=${u.mode} cursor=${u.cursorRow} R032.working=${JSON.stringify(r.working)} toast=${await T.toast(page)}`)
  }
})
await step('U2-02', async () => {
  const tries = [
    ['issue kind', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+I') }],
    ['issue text', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('q') }],
    ['adopt panel', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+A') }],
    ['columns', async () => { await sel(page, 'R030'); await page.keyboard.press('c') }],
    ['weights', async () => { await sel(page, 'R030'); await page.keyboard.press('w') }],
    ['quickfix', async () => { await sel(page, 'R009'); await page.keyboard.press('Control+.') }],
    ['export', async () => { await page.keyboard.press('Control+e') }],
    ['settings', async () => { await runPalette(page, '案件設定') }],
    ['help', async () => { await page.keyboard.press('?') }],
    ['inbox', async () => { await page.keyboard.press('Control+p') }],
    ['goto', async () => { await page.keyboard.press('Control+g') }],
    ['replace r', async () => { await sel(page, 'R030'); await page.keyboard.press('r') }],
    ['publish reason', async () => { await page.keyboard.press('Control+Enter') }],
    ['delete confirm', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+Delete') }],
  ]
  for (const [label, open] of tries) {
    await fresh(page); await page.keyboard.press('1'); await open(); await page.waitForTimeout(100)
    const p0 = await T.panel(page); await page.keyboard.press('Control+k'); await page.waitForTimeout(80)
    log(`U2-02 [${label}] ${p0} -> Ctrl+K -> ${await T.panel(page)}`)
  }
})
await step('U3-04 detail', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press(' '); await page.waitForTimeout(100)
  log('detail thead', (await page.locator('table.quotes thead').first().innerText().catch(() => '-')).replace(/\s+/g, ' '))
  await shot(page, 't12_detail')
})
save(errors); await browser.close()
