// 3 発注・入荷: 入荷の列に打つだけ（Enter なし）／ 打って Enter ／ 打って ↓
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y09_boolcol')
for (const [col, v, after] of [['入荷', '11/5', null], ['入荷', 'zumi', null], ['入荷', '11/5', 'Enter'], ['入荷', 'zumi', 'ArrowDown'], ['発注', 'ok', null], ['発注', '20', 'Enter']]) {
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+3'); await sleep(100); await sel(page, 'R013'); await gotoCol(page, col)
  const r0 = await row(page, 'R013')
  await typeReal(page, v, 40); await sleep(80); const t1 = await T.toast(page); const u1 = await ui(page)
  if (after) { await page.keyboard.press(after); await sleep(120) }
  const r1 = await row(page, 'R013'); const u = await ui(page)
  log(`${col}「${v}」${after ?? '(打つだけ)'}: view ${u1.view}->${u.view} cur=${u.cursorRow}/${u.cursorCol} | ordered ${r0.ordered}->${r1.ordered} received ${r0.received}->${r1.received} status ${r0.status}->${r1.status} | toast after typing: ${t1} | toast end: ${await T.toast(page)}`)
}
save(errors); await browser.close()
