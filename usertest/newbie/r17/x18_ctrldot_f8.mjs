import { launch, fresh, T, makeLog, ui, sleep, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x18_ctrldot_f8')
for (const [n, val] of [[3, 'オムロン'], [2, 'オムロン']]) {
  log(`== F8 ×${n} → Ctrl+. → 1（編集する）→ 直す → Enter → F8 ×3`)
  await fresh(page); for (let i = 0; i < n; i++) { await page.keyboard.press('F8'); await sleep(50) }
  log('  at', await T.cursor(page))
  await page.keyboard.press('Control+.'); await sleep(120); log('  panel', (await T.panelText(page))?.slice(0, 120))
  await page.keyboard.press('Enter'); await sleep(80); await page.keyboard.insertText(val); await page.keyboard.press('Enter'); await sleep(120)
  log('  after fix at', await T.cursor(page))
  const seq = []; for (let i = 0; i < 3; i++) { await page.keyboard.press('F8'); await sleep(60); seq.push(await T.cursor(page)) } log('  F8:', seq.join(' → '))
  log('== 同じを Ctrl+. を使わず直接打って')
  await fresh(page); for (let i = 0; i < n; i++) { await page.keyboard.press('F8'); await sleep(50) }
  await page.keyboard.insertText(''); await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.insertText(val); await page.keyboard.press('Enter'); await sleep(120)
  const seq2 = []; for (let i = 0; i < 3; i++) { await page.keyboard.press('F8'); await sleep(60); seq2.push(await T.cursor(page)) } log('  F8:', seq2.join(' → '))
}
save(errors); await browser.close()
