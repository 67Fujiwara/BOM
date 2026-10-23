import fs from 'node:fs'
import { open, reset, sleep } from './lib13.mjs'
const env = await open(5176); const page = env.page
await reset(env)
const w = await page.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
fs.writeFileSync('dl/bom-utf8.json', '﻿' + w)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150)
await page.getByTestId('import-file').setInputFiles('dl/bom-utf8.json'); await sleep(500)
await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(300)
console.log(await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent), await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.slice(0, 80)))
await env.browser.close()
