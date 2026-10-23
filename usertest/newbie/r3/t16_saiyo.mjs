// 設計の新人: 今の行を採用したくてパレットに「採用」→ Enter
import { launch, fresh, T, makeLog, shot, sel, proj, palette, paletteTop } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t16_saiyo')
for (const w of ['採用', '推奨で採用', 'さいよう', '一括']) {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030')
  const a0 = (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length
  await palette(page, w); const top = await paletteTop(page, 3)
  await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  const p = await proj(page)
  log(`"${w}" top=[${top.join(' || ')}] Enter -> toast=${await T.toast(page)} panel=${await T.panelText(page)} adopted ${a0} -> ${p.rows.filter((r) => r.adoptedSupplierId).length} contested=${p.rows.filter((r) => r.flags.contested).length}`)
  await shot(page, `t16_${w}`)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100)
  log(`   Ctrl+Z -> ${await T.toast(page)} adopted ${(await proj(page)).rows.filter((r) => r.adoptedSupplierId).length}`)
}
save(errors)
await browser.close()
