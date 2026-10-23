import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x11_publish_enter')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 120)} | toast: ${await T.toast(page)}`) }
for (const [v, keys] of [[1, ['2', 'Enter']], [4, ['2', 'Enter']], [4, ['Enter']], [4, ['ArrowDown', 'Enter']], [1, ['2', 'Enter', 'Enter']]]) {
  log(`== view ${v}: R030 必要数 3 → Ctrl+Enter → ${keys.join(' ')}`)
  await fresh(page); await page.keyboard.press('Alt+' + v); await sleep(80); await sel(page, 'R030'); await gotoCol(page, '必要数'); await typeReal(page, '3', 20); await page.keyboard.press('Enter'); await sleep(80); await st('edited')
  await page.keyboard.press('Control+Enter'); await sleep(150); await st('Ctrl+Enter')
  for (const k of keys) { await page.keyboard.press(k); await sleep(150); await st(k) }
  const p = await proj(page); log('  R009 working', JSON.stringify(p.rows.find((r) => r.id === 'R009').working ?? null), 'subs', p.submissions.length)
}
save(errors); await browser.close()
