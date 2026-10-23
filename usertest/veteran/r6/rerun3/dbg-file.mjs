import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, palette, sleep, panel, toastNow, DL, ws } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
fs.writeFileSync(path.join(DL, 'broken.xlsx'), 'this is not a zip')
fs.writeFileSync(path.join(DL, 'noext'), fs.readFileSync(path.join(DL, 'broken.xlsx')))
fs.writeFileSync(path.join(DL, 'bin.csv'), Buffer.from([0, 1, 2, 3, 255, 254, 0, 0, 65, 66]))
for (const f of ['broken.xlsx', 'noext', 'bin.csv']) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-' + f.replace(/\W/g, '')); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  console.log('step text', (await page.locator('[data-testid="panel-wizard"]').innerText()).slice(-200).replace(/\n/g, ' | '))
  const n = await page.getByTestId('wizard-file').count()
  if (n) { await page.getByTestId('wizard-file').setInputFiles(path.join(DL, f)); await sleep(600) }
  console.log(f, 'fileInput', n, 'toast:', (await toastNow(page)).slice(0, 150))
  await page.keyboard.press('Escape'); await sleep(30); await page.keyboard.press('Escape')
}
// JSON の BOM つきファイル
fs.writeFileSync(path.join(DL, 'bom.json'), '﻿' + JSON.stringify({ projects: [{ id: 'BOMFILE', rows: [{ id: 'R001', name: 'x' }] }] }))
await page.locator('.gridwrap').focus()
await palette(page, 'JSON を読み込む'); await sleep(40)
await page.getByTestId('import-file').setInputFiles(path.join(DL, 'bom.json')); await sleep(300)
console.log('json file toast', (await toastNow(page)).slice(0, 150), await panel(page))
await page.keyboard.press('Control+Enter'); await sleep(100)
console.log('after ctrl+enter', (await toastNow(page)).slice(0, 150), await panel(page))
await browser.close()
