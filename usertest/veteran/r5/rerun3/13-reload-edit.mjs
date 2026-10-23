// 編集中のリロード（確定されるか）・読めない値のままリロード（離脱確認）
import { launch, fresh, goto, toColKey, sleep, save, proj, mode } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
await goto(page, 'R030'); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('リロード中の入力')
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
const r = (await proj(page)).rows.find((x) => x.id === 'R030')
out.validValue = r.working?.name ?? r.name
await page.locator('.gridwrap').focus()
await goto(page, 'R030'); await toColKey(page, 'qtyNeeded'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('abc')
const n = errors.length
await page.reload({ timeout: 5000 }).catch((e) => (out.reloadErr = e.message.slice(0, 80)))
await sleep(300)
out.invalidValue = { dialogs: errors.slice(n).filter((e) => e.type === 'dialog').map((e) => e.text), modeAfter: await mode(page).catch(() => null) }
console.log(JSON.stringify(out))
save('13-reload-edit.json', out)
await browser.close()
