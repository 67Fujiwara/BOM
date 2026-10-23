// 途中でリロード / Undo、1024×700・ダークでステータスバーのヒントが読めるか
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, row, sleep, attachErrors } from './lib.mjs'
const { log, save } = makeLog('t36_reload_layout')
const allErr = []
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
{
  const { browser, page, errors } = await launch(); allErr.push(errors)
  const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | toast: ${await T.toast(page)}`) }
  await step('編集中にリロード（F5）', async () => {
    await fresh(page); await page.keyboard.press('1'); await sel(page, 'R041'); await gotoCol(page, 'メーカ')
    await typeReal(page, 'Keyence', 40); await state('typing')
    await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await state('after reload')
    const r = await row(page, 'R041'); log('  R041 maker', r.maker, JSON.stringify(r.working ?? null))
  })
  await step('確定 → リロード → Ctrl+Z', async () => {
    await page.keyboard.press('Escape'); await sel(page, 'R042'); await gotoCol(page, 'メーカ'); await typeReal(page, 'Omron', 40); await page.keyboard.press('Enter'); await sleep(150)
    await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await state('after reload')
    log('  R042', JSON.stringify((await row(page, 'R042')).working ?? null))
    await page.keyboard.press('Control+z'); await sleep(150); await state('Ctrl+Z'); log('  R042', JSON.stringify((await row(page, 'R042')).working ?? null))
    await page.keyboard.press('Control+y'); await sleep(150); await state('Ctrl+Y'); log('  R042', JSON.stringify((await row(page, 'R042')).working ?? null))
  })
  await step('Ctrl+Z を押しすぎる（10 回）', async () => {
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Control+z'); await sleep(60) }
    await state('Ctrl+Z x10'); log('  R042', JSON.stringify((await row(page, 'R042')).working ?? null))
  })
  await step('ガイドの途中でリロード', async () => {
    await fresh(page); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(60); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    await page.getByTestId('wizard-id').fill('RLD-1'); await page.keyboard.press('Enter'); await page.keyboard.insertText('リロード案件'); await page.keyboard.press('Enter'); await sleep(80)
    await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await state('after reload')
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(60); await page.keyboard.press('Enter'); await sleep(150)
    log('  reopen', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Escape')
  })
  await browser.close()
}
for (const scheme of ['light', 'dark']) {
  const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 }, colorScheme: scheme }); allErr.push(errors)
  await step(`1024x700 ${scheme}`, async () => {
    await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await gotoCol(page, '型式'); await sleep(200)
    const m = await page.evaluate(() => { const h = document.querySelector('.status .hints'); const s = document.querySelector('.status'); const r = h.getBoundingClientRect(); const items = [...h.children].map((c) => { const b = c.getBoundingClientRect(); return [c.textContent, Math.round(b.left), Math.round(b.right), Math.round(b.top)] }); return { statusW: s.clientWidth, statusScrollW: s.scrollWidth, hintsRight: Math.round(r.right), vw: innerWidth, items, bodyScrollW: document.documentElement.scrollWidth } })
    log('  ', JSON.stringify(m))
    await shot(page, `t36_1024_${scheme}_status`)
    await page.keyboard.press('F8'); await sleep(150); await page.keyboard.press('Control+Enter'); await sleep(200)
    await shot(page, `t36_1024_${scheme}_publish`); if (await T.panel(page)) await page.keyboard.press('Escape')
  })
  await browser.close()
}
save(allErr.flat())
