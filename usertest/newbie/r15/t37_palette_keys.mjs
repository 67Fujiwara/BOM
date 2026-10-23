import { launch, fresh, T, makeLog, sel, gotoCol, palette, paletteTop, sleep, ui } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t37_palette_keys')
await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await gotoCol(page, '型式')
for (const q of ['次の問題', '確認済', '置換', '隠す', '並び替え', '発注', '指摘', '採用', '最安', 'alt', 'Alt', 'F8', '英字', '入力できない', '打てない']) {
  await palette(page, q); log(`"${q}" ->`, JSON.stringify(await paletteTop(page, 3))); await page.keyboard.press('Escape')
}
// パレットから実行すれば打てるセルでも効く？
await palette(page, '次の問題'); await page.keyboard.press('Enter'); await sleep(150); const u = await ui(page); log('palette 次の問題 ->', u.cursorRow, u.cursorCol, u.mode, await T.toast(page))
save(errors); await browser.close()
