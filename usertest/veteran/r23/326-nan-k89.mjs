import fs from 'node:fs'
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
const items = JSON.parse(fs.readFileSync('/home/user/BOM/usertest/veteran/r23/dl/137-mutated.json', 'utf8'))
const it = items[89]
console.log(JSON.stringify(it.muts))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const pg = await (await browser.newContext({ locale: 'ja-JP', viewport: { width: 1440, height: 900 } })).newPage()
const msgs = []
pg.on('console', (m) => { if (m.type() === 'error') msgs.push({ text: m.text().slice(0, 300), loc: m.location() }) })
await pg.goto('http://localhost:'+(process.env.PORT??5176)+'/'); await pg.waitForSelector('[data-testid="grid"]')
const ws = structuredClone(it.ws); ws.user = { ...(ws.user ?? {}), name: '田中', role: 'design' }
await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, ['bom-pro.workspace.v2', JSON.stringify(ws)])
await pg.reload({ waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 800))
console.log('after load', msgs.length)
await pg.locator('.gridwrap').focus()
for (const key of ['Alt+1', 'ArrowDown', 'Space', 'Escape', 'Alt+2', 'Alt+3', 'Alt+4', 'F8', 'Alt+5', 'Alt+6', 'Alt+7', 'ArrowDown', 'Alt+8', 'Alt+9', 'Space']) {
  const n0 = msgs.length
  await pg.keyboard.press(key); await new Promise((r) => setTimeout(r, 80))
  if (msgs.length > n0) console.log('after', key, JSON.stringify(msgs.slice(n0)).slice(0, 500))
}
// 商社マスタ画面は?
const bodyText = await pg.evaluate(() => document.body.innerText)
const ix = bodyText.indexOf('NaN')
console.log('NaN in page text:', ix >= 0 ? bodyText.slice(Math.max(0, ix - 60), ix + 30).replace(/\s+/g, ' ') : 'none')
const html = await pg.evaluate(() => document.querySelector('[style*="NaN"]')?.outerHTML?.slice(0, 200) ?? 'none')
console.log('NaN style element', html)
await browser.close()
