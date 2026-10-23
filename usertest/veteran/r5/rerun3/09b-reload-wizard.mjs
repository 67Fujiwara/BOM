// リロードで ガイドの途中（貼り付けた 300 行）・ビュー 5・最近使ったコマンドが戻るか
import { launch, fresh, palette, sleep, panel, toastNow, bom300, paletteItems } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
await palette(page, 'ダークモード切替'); await sleep(30); await palette(page, 'ダークモード切替'); await sleep(30)
const recentBefore = (await paletteItems(page, '')).slice(0, 2)
await page.keyboard.press('5'); await sleep(50)
await palette(page, '新しいBOM'); await sleep(40)
await page.getByTestId('wizard-id').fill('P-DRAFT'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-name').fill('リロードで消える？'); await page.keyboard.press('Enter')
for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')
await page.getByTestId('wizard-paste').fill(bom300()); await sleep(800)
const ssBefore = await page.evaluate(() => JSON.parse(sessionStorage.getItem('bom-pro.ui') ?? '{}'))
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await sleep(100)
const view = await page.evaluate(() => document.querySelector('[aria-current="true"]')?.textContent ?? document.querySelector('.side .active, .side [aria-pressed="true"]')?.textContent)
const recentAfter = (await paletteItems(page, '')).slice(0, 2)
await palette(page, '新しいBOM'); await sleep(60)
const w = { panel: await panel(page), id: await page.getByTestId('wizard-id').inputValue().catch(() => null), paste: (await page.getByTestId('wizard-paste').inputValue().catch(() => '')).length, text: (await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => '')).slice(0, 80) }
out.result = { draftSavedInSession: { step: ssBefore.wizardDraft?.step, pasteLen: ssBefore.wizardDraft?.data?.paste?.length, view: ssBefore.view }, afterReload: { view, recentBefore, recentAfter, wizard: w } }
console.log(JSON.stringify(out.result, null, 1))
import fs from 'node:fs'
fs.writeFileSync('/home/user/BOM/usertest/veteran/r5/rerun3/09b-reload-wizard.json', JSON.stringify(out, null, 2))
await browser.close()
