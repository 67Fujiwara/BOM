// ラウンド8: macOS の Option 文字（µ Ω °）を絞り込み欄（Alt+/ で入る）・ジャンプ（Ctrl+G）・指摘の本文に（V7-02 の残りの場面）
import { open, reset, gotoCell, sleep, saveJson, cdpKey } from './lib8.mjs'
const env = await open(5176); const pg = env.page; const out = []
const cdp = await env.context.newCDPSession(pg)
const KS = [['µ', { key: 'µ', code: 'KeyM', text: 'µ', mods: 1, vk: 77 }], ['Ω', { key: 'Ω', code: 'KeyZ', text: 'Ω', mods: 1, vk: 90 }], ['°', { key: '°', code: 'Digit8', text: '°', mods: 9, vk: 56 }]]
for (const [name, k] of KS) {
  await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
  await pg.keyboard.press('Alt+/'); await pg.keyboard.type('10'); await cdpKey(cdp, k); await sleep(50)
  const filter = await pg.evaluate(() => document.activeElement?.value ?? null)
  await pg.keyboard.press('Escape'); await pg.locator('.gridwrap').focus()
  await pg.keyboard.press('Control+g'); await pg.keyboard.type('10'); await cdpKey(cdp, k); await sleep(50)
  const jump = await pg.evaluate(() => document.activeElement?.value ?? null)
  await pg.keyboard.press('Escape')
  const rec = { name, filter, jump }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('28-option-filter.json', out); await env.browser.close()
