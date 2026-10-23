// 購買の新人: 6 商社別を開いてすぐ単価を打つ（どこに入るか）
import { launch, fresh, T, makeLog, ui, typeReal, proj, sleep, shot, sel } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x15_purch_6_start')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | cursorbar=${await T.cursor(page)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
for (const [how, keys] of [['Alt+6 → 1200', ['Alt+6']], ['Alt+6 → ↓ → 1200', ['Alt+6', 'ArrowDown']], ['サイドの 6 をクリック → 1200', ['click6']], ['Alt+8 → 1500', ['Alt+8']]]) {
  log('== ' + how)
  await fresh(page, 'purchasing'); await sleep(150)
  for (const k of keys) { if (k === 'click6') await page.getByTestId('view-6').click(); else await page.keyboard.press(k); await sleep(100) }
  await st('opened'); await shot(page, `x15_${how.replace(/\W/g, '_')}`)
  const p0 = await proj(page)
  await typeReal(page, how.includes('1500') ? '1500' : '1200', 30); await sleep(80); await st('typed')
  await page.keyboard.press('Enter'); await sleep(120); await st('Enter')
  const p1 = await proj(page); const ch = p1.quotes.filter((q) => { const q0 = p0.quotes.find((x) => x.rowId === q.rowId && x.supplierId === q.supplierId && !x.stale); return !q.stale && JSON.stringify(q0) !== JSON.stringify(q) }).map((q) => `${q.rowId}@${q.supplierId} price=${q.unitPrice} formal=${q.formalPrice}`)
  log('  quote changes:', ch.join(', ') || '(なし)')
}
save(errors); await browser.close()
