// ラウンド13: 変な瞬間のリロード（ガイドのプレビュー中・2,500 行の作成の直後・公開のダイアログ中・JSON の読み込み直後・ドラッグなし）
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib17.mjs'
const { browser, page, errors } = await launch()
const out = []
const info = async () => { const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId); return { nproj: w?.projects.length, cur: w?.currentProjectId, rows: p?.rows.length, revs: p?.submissions.length, r010: p?.rows.find((r) => r.id === 'R010')?.working?.name ?? p?.rows.find((r) => r.id === 'R010')?.name } }
const reload = async () => { await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await sleep(300) }
async function wizardTo(file) {
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-RL' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  await page.getByTestId('wizard-file').setInputFiles('/home/user/BOM/usertest/veteran/r17/dl/' + file)
  for (let i = 0; i < 100; i++) { if (/読み込みました/.test(await toastNow(page))) break; await sleep(100) }
}
// R1 プレビュー中にリロード
await fresh(page); await wizardTo('m5-2500-pages.xlsx'); await page.keyboard.press('Enter'); await sleep(300)
const b1 = await info(); await reload(); out.push({ case: 'R1 ガイドのプレビュー中にリロード', before: b1, after: await info(), panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null), toast: await toastNow(page) })
// R2 2,500 行の作成の Enter の直後（0ms）にリロード
await fresh(page); await wizardTo('m5-2500-pages.xlsx'); await page.keyboard.press('Enter'); await sleep(300)
await page.keyboard.press('Enter'); await page.evaluate(() => location.reload()); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await sleep(300)
out.push({ case: 'R2 2,500 行の作成の Enter 直後にリロード', after: await info(), toast: await toastNow(page) })
// R3 2,500 行の作成のあと Ctrl+Z → すぐリロード
await page.keyboard.press('Control+z'); await page.evaluate(() => location.reload()); await page.waitForSelector('[data-testid="grid"]'); await sleep(300)
out.push({ case: 'R3 その案件で Ctrl+Z → 直後にリロード', after: await info(), toast: await toastNow(page) })
// R4 公開のダイアログを開いたままリロード → Ctrl+Enter をもう一度
await fresh(page); await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R010'); await page.keyboard.press('Enter'); await page.keyboard.type('RL'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await sleep(150); await page.keyboard.press('2'); await reload()
out.push({ case: 'R4 公開のダイアログで 2 を選んだままリロード', after: await info(), panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null) })
for (const o of out) console.log(JSON.stringify(o))
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'warning').slice(0, 5)))
saveJson('69-reload-r13.json', { out, errors })
await browser.close()
