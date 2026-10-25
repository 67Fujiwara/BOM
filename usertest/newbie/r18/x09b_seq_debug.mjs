import { launch, fresh, T, makeLog, ui, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x09b_seq_debug')
const s = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} panel=${u.panel} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | ${(await T.panelText(page))?.slice(0, 80)} | toast ${await T.toast(page)}`) }
for (const variant of ['ctrlA', 'direct', 'tab']) {
  log('== variant', variant)
  await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(150); await s('seq')
  await page.keyboard.press('Enter'); await sleep(100); await s('Enter 編集する')
  if (variant === 'ctrlA') { await page.keyboard.press('Control+a'); await page.keyboard.insertText('NEW-1 10A') } else await page.keyboard.type('X', { delay: 20 })
  await s('typed')
  await page.keyboard.press(variant === 'tab' ? 'Tab' : 'Enter'); await sleep(50); await s('commit +50ms'); await sleep(200); await s('+250ms')
}
log('== F8 だけ: R016 を直して（Enter）F8')
await fresh(page); await page.keyboard.press('F8'); await sleep(50); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('NEW-1 10A'); await page.keyboard.press('Tab'); await sleep(100); await s('fixed with Tab')
await page.keyboard.press('F8'); await sleep(80); await s('F8')
save(errors); await browser.close()
