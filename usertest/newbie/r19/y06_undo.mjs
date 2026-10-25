// Ctrl+Z が効かない？の確認
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y06_undo')
const w = async () => JSON.stringify([(await row(page, 'R030')).working, (await row(page, 'R031')).working, (await row(page, 'R032')).working])
for (const variant of ['one', 'three', 'three-slow']) {
  log('== ' + variant)
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, '必要数')
  const vals = variant === 'one' ? ['3'] : ['3', '4', '5']
  for (const v of vals) { await typeReal(page, v); await page.keyboard.press('Enter'); await sleep(variant === 'three-slow' ? 600 : 50) }
  const u = await ui(page); log(`  after typing mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} ${await w()}`)
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Control+z'); await sleep(variant === 'three-slow' ? 400 : 80); log(`  Ctrl+Z #${i + 1}: ${await T.toast(page)} | ${await w()}`) }
  const h = await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); const s = m.useStore.getState(); return Object.keys(s).filter((k) => /undo|hist|past/i.test(k)).map((k) => k + ':' + JSON.stringify(s[k])?.slice(0, 200)) })
  log('  store keys', JSON.stringify(h))
}
save(errors); await browser.close()
