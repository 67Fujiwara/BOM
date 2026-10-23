// 打ち間違えたセルで Ctrl+Z（Excel なら入力の取り消し）→ ↓
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z10_ctrlz_typing')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} lbl=${await T.mode(page)} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
for (const [col, txt, after] of [['型式', 'MY4N', 'ArrowDown'], ['必要数', '120', 'ArrowDown'], ['部品名', 'relay', 'Enter'], ['型式', 'MY4N', 'Escape']]) {
  log(`== ${col}: ${txt} → Ctrl+Z → ${after}`)
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, col)
  const before = await row(page, 'R030')
  await typeReal(page, txt, 80); await st('typed'); await page.keyboard.press('Control+z'); await sleep(100); await st('Ctrl+Z')
  if (col === '型式' && after === 'ArrowDown') await shot(page, 'z10_after_ctrlz')
  await page.keyboard.press('Control+z'); await sleep(100); await st('Ctrl+Z 2')
  await page.keyboard.press(after); await sleep(120); await st(after)
  const r = await row(page, 'R030'); log(`  R030 working: ${JSON.stringify(r.working ?? null)} (before name=${before.name} model=${before.model} qty=${before.qtyNeeded})`)
}
save(errors); await browser.close()
