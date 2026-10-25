// 「あとで（公開を止めない。表では Shift+→）」を選んでから公開
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, sleep, row, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y13_defer')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 260) ?? ''} | toast: ${await T.toast(page)}`) }
log('== A: 設計が自分で作った問題だけ（R030 型式を空にする）→ Ctrl+. → あとで → Ctrl+Enter')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Delete'); await sleep(80); await st('Delete maker')
await page.keyboard.press('Control+.'); await sleep(100); await st('Ctrl+.')
const txt = await T.panelText(page); const m = /(\d) [^0-9]*あとで/.exec(txt); log('  あとで option = ' + (m?.[1]))
if (m) { await page.keyboard.press(m[1]); await sleep(100); await st('pick あとで') }
log('  R030 deferred', JSON.stringify((await row(page, 'R030')).deferredRules))
await page.keyboard.press('Control+Enter'); await sleep(150); await st('Ctrl+Enter')
await shot(page, 'y13_defer_publish')
log('== B: 表で Shift+→（あとで）→ Ctrl+Enter')
await fresh(page); await sel(page, 'R031'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Delete'); await sleep(80)
await page.keyboard.press('Shift+ArrowRight'); await sleep(100); await st('Shift+→')
await page.keyboard.press('Control+Enter'); await sleep(150); await st('Ctrl+Enter')
save(errors); await browser.close()
