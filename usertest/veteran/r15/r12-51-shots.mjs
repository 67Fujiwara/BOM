// ラウンド12: 証跡のスクリーンショット
import path from 'node:path'
import { launch, fresh, palette, sleep, toastNow } from '../r8/rerun7/rerun6/lib.mjs'
import { open, reset, gotoCell } from './lib15.mjs'
import { tok } from './run14.mjs'
const SH = (f) => path.join('/home/user/BOM/usertest/veteran/r15/shots', f)
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r15/dl', f)
{
  const { browser, page } = await launch()
  for (const [f, shot] of [['x2-tbd-rows.xlsx', 'V12-tbd-rows-dropped-preview.png'], ['x1-hidden-qty-visible-insu.xlsx', 'V12-hidden-qty-over-visible-preview.png'], ['x3-title-2fields.xlsx', 'V12-title-row-as-header-preview.png'], ['x4-page2-reordered.xlsx', 'V12-page2-reordered-preview.png']]) {
    await fresh(page); await palette(page, '新しいBOM'); await sleep(40)
    await page.getByTestId('wizard-id').fill('P-S'); await page.keyboard.press('Enter')
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
    await page.keyboard.press('2'); await sleep(60)
    await page.getByTestId('wizard-file').setInputFiles(P(f))
    for (let i = 0; i < 100; i++) { if (/読み込みました/.test(await toastNow(page))) break; await sleep(100) }
    await page.keyboard.press('Enter'); await sleep(500)
    await page.screenshot({ path: SH(shot) })
  }
  await browser.close()
}
{
  const env = await open(5176); const pg = env.page
  await reset(env); await pg.keyboard.press('Alt+4'); await sleep(80)
  for (const t of ['G:R054', 'C:必要数', 'T:5', 'ArrowRight', 'NP:1', 'NP:7']) { await tok(env, t); await sleep(80) }
  await pg.screenshot({ path: SH('V12-numpad-norow-R001-typed.png') })
  await reset(env); await pg.keyboard.press('Alt+1'); await sleep(80)
  for (const t of ['F8', 'PageDown']) { await tok(env, t); await sleep(80) }
  await pg.screenshot({ path: SH('V11-01-pagedown-header-before-F8.png') })
  await tok(env, 'F8'); await sleep(100); await pg.screenshot({ path: SH('V11-01-pagedown-after-F8-R005.png') })
  await env.browser.close()
}
