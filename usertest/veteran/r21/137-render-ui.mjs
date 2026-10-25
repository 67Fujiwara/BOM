// ラウンド18: 131-render-fuzz（node で描画の関数）の続き。変異させた保存データ（sanitize を通るもの、DUMP で書き出した dl/137-mutated.json）を
// localStorage に入れてリロードし、3 役割 × ビュー 1〜9・Space（詳細）・F8・Ctrl+K で、画面が出るか（白い画面・「画面を表示できませんでした」・pageerror）
import fs from 'node:fs'
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
const port = Number(process.env.PORT ?? 5176)
const URL = `http://localhost:${port}/`
const LSK = 'bom-pro.workspace.v2'
const items = JSON.parse(fs.readFileSync('/home/user/BOM/usertest/veteran/r21/dl/137-mutated.json', 'utf8'))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1440, height: 900 } })
const pg = await ctx.newPage()
let errs = []
pg.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)))
pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
pg.on('dialog', (d) => d.dismiss().catch(() => {}))
await pg.goto(URL); await pg.waitForSelector('[data-testid="grid"]')
const out = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const limit = Number(process.env.LIMIT ?? items.length)
for (let k = 0; k < Math.min(limit, items.length); k++) {
  const it = items[k]
  for (const role of ['design', 'purchasing', 'pm']) {
    errs = []
    const ws = structuredClone(it.ws); ws.user = { ...(ws.user ?? {}), name: role === 'design' ? '田中' : role === 'pm' ? '鈴木' : '佐藤', role }
    await pg.evaluate(([k2, s]) => { localStorage.clear(); localStorage.setItem(k2, s) }, [LSK, JSON.stringify(ws)])
    await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(500)
    const ok0 = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
    const steps = []
    if (ok0) {
      await pg.locator('.gridwrap').focus().catch(() => {})
      for (const key of ['Alt+1', 'ArrowDown', 'Space', 'Escape', 'Alt+2', 'Alt+3', 'Alt+4', 'F8', 'Alt+5', 'Alt+6', 'Alt+7', 'ArrowDown', 'Alt+8', 'Alt+9', 'ArrowDown', 'Space', 'Escape', 'Control+k', 'Escape']) {
        await pg.keyboard.press(key).catch(() => {}); await sleep(30)
        const crash = await pg.evaluate(() => !!document.querySelector('[data-testid="crash"]') || !document.querySelector('#root')?.childElementCount)
        if (crash) { steps.push(`crash after ${key}`); break }
      }
    }
    const crash = await pg.evaluate(() => (document.querySelector('[data-testid="crash"]')?.textContent ?? '').slice(0, 200))
    const rec = { k, role, muts: it.muts, grid: ok0, steps, crash, errs: errs.slice(0, 4) }
    if (!ok0 || steps.length || crash || errs.length) { out.push(rec); console.log(JSON.stringify(rec).slice(0, 800)) }
  }
}
console.log('done', Math.min(limit, items.length), 'bad', out.length)
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r21/137-render-ui-${port}${process.env.RUN ?? ''}.json`, JSON.stringify({ n: Math.min(limit, items.length), bad: out }, null, 2))
await browser.close()
