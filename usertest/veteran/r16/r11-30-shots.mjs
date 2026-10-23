// ラウンド11: 証跡のスクリーンショット
import path from 'node:path'
import { open, reset, sleep, gotoCell } from './lib16.mjs'
import { launch, fresh, palette, toastNow } from '../r8/rerun7/rerun6/lib.mjs'
const SH = (f) => `/home/user/BOM/usertest/veteran/r16/shots/${f}`
const env = await open(5176); const pg = env.page
// V11-01: F8 → ↓×15 → F8 で上の R009 へ戻る
await reset(env); await pg.keyboard.press('F8'); for (let i = 0; i < 15; i++) await pg.keyboard.press('ArrowDown'); await pg.screenshot({ path: SH('V11-01-before-F8-R019.png') })
await pg.keyboard.press('F8'); await sleep(150); await pg.screenshot({ path: SH('V11-01-after-F8-R009.png') })
// V10-05 残り: 保存できないのに「隠しました」
await reset(env); await gotoCell(pg, 1, 'R010', 'ID')
await pg.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === 'bom-pro.workspace.v2') throw new DOMException('q', 'QuotaExceededError'); return orig.call(this, k, v) } })
await pg.keyboard.press('Alt+h'); await sleep(200); await pg.screenshot({ path: SH('V10-05-hide-success-toast-unsaved.png') })
await env.browser.close()
// V11-03: 表題欄の「台数 2台」＋ 数量の列を隠した Excel のプレビュー、V11-04: ページ番号つきの繰り返し見出し
const { browser, page } = await launch()
for (const [f, shot] of [['title-daisu-qty-hidden.xlsx', 'V11-03-preview-qty-missing.png'], ['page-headers-pageno.xlsx', 'V11-04-preview-last-page-only.png']]) {
  await fresh(page); await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-S'); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  await page.getByTestId('wizard-file').setInputFiles(path.join('/home/user/BOM/usertest/veteran/r16/dl', f))
  for (let i = 0; i < 40; i++) { if (/読み込みました/.test(await toastNow(page))) break; await sleep(250) }
  await page.keyboard.press('Enter'); await sleep(400); await page.screenshot({ path: SH(shot) })
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
await browser.close()
console.log('ok')
