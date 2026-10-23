// ラウンド13: 1024×700・ダークで、ガイドのプレビュー（⚠ が多いとき）、公開の理由ダイアログ（文字の欄の状態）、順番に直すモード、選択の候補
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, palette } from './lib.mjs'
const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 }, colorScheme: 'dark' })
const { log, save } = makeLog('v08_small_dark')
const box = async (loc) => { const b = await loc.boundingBox().catch(() => null); return b ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)} bottom=${Math.round(b.y + b.height)}` : '-' }
await fresh(page)
log('scroll', await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.documentElement.scrollHeight, document.documentElement.clientHeight].join(',')))
// ガイド: ⚠ の多いファイル
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('2'); await sleep(80)
await page.getByTestId('wizard-file').setInputFiles('/home/user/BOM/usertest/newbie/r16/files12/h2_twotier.xlsx'); await sleep(1200)
await page.keyboard.press('Enter'); await sleep(200)
log('wizard', await box(page.getByTestId('wizard')), 'preview', await box(page.getByTestId('wizard-preview')))
const pv = page.getByTestId('wizard-preview')
log('preview scroll', await pv.evaluate((e) => [e.scrollHeight, e.clientHeight, getComputedStyle(e).overflowY].join(',')).catch(() => '-'))
await shot(page, 'v08_wizard_preview_1024dark')
await page.keyboard.press('Enter'); await sleep(300)
await shot(page, 'v08_after_create_1024dark')
log('toast', await T.toast(page), await box(page.getByTestId('toast-float')))
// 公開ダイアログ
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await typeReal(page, 'Lamp'); await page.keyboard.press('Enter'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(150); await page.keyboard.press('1'); await page.keyboard.press('Tab'); await typeReal(page, '2026-012'); await sleep(100)
log('dialog', await box(page.locator('.overlay .dialog')), 'foot', (await page.locator('.overlay .dialog').innerText()).replace(/\s+/g, ' ').slice(-120))
await shot(page, 'v08_publish_text_state_1024dark')
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(100)
// 順番に直すモードのパネル
await page.keyboard.press('Control+Shift+F'); await sleep(250)
log('quickfix', await box(page.locator('.overlay .dialog')))
await shot(page, 'v08_sequence_1024dark')
save(errors); await browser.close()
