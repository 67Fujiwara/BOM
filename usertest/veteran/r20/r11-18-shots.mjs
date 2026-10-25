// ラウンド10: 証跡のスクリーンショット（V10-02 理由のダイアログ、V10-03 選択が外れた直後の → →、V10-01 1 すべての F8）
import { open, reset, sleep, gotoCell } from './lib20.mjs'
const env = await open(5176); const pg = env.page
await reset(env); await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R004'); await pg.keyboard.press('Enter'); await sleep(60); await pg.keyboard.press('Home')
await pg.keyboard.press('Shift+A'); await sleep(100); await pg.keyboard.press('2'); await sleep(100); await pg.keyboard.press('2'); await pg.keyboard.type('3日で入る'); await sleep(100)
await pg.screenshot({ path: 'shots/V10-02-dialog-before-enter.png' })
await pg.keyboard.press('Enter'); await sleep(200); await pg.screenshot({ path: 'shots/V10-02-after-enter.png' })
await reset(env); await gotoCell(pg, 4, 'R054', '必要数'); await pg.keyboard.type('5'); await pg.keyboard.press('ArrowRight'); await sleep(100); await pg.screenshot({ path: 'shots/V10-03-deselected.png' })
await pg.keyboard.press('ArrowRight'); await pg.keyboard.type('7'); await sleep(100); await pg.screenshot({ path: 'shots/V10-03-R016-editing.png' })
await pg.keyboard.press('Enter')
await reset(env); await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+Home'); await pg.keyboard.press('F8'); await pg.keyboard.press('F8'); await sleep(100); await pg.screenshot({ path: 'shots/V10-01-view1-second-F8-R061.png' })
console.log(env.errs); await env.browser.close()
