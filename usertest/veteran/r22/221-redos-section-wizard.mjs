// ラウンド20: 矢印の正規表現の ReDoS（178）をガイドの画面で: 型式のセルが「x＋空白 N 個＋y」の .csv を読ませて、プレビューが出るまで・画面が固まる時間（キー入力の応答）
import fs from 'node:fs'
import { launch, fresh, palette, sleep, toastNow } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = Number(process.env.NN ?? 100000)
const DL = '/home/user/BOM/usertest/veteran/r22/dl/'
const f = `${DL}redos3-${N}.csv`
fs.writeFileSync(f, `部品名,型式,数量\nリレー,MY4N,1\n部品表${'1'.repeat(N)}\n端子台,XW2B,2\n`)
const { browser, page, errors } = await launch()
await fresh(page)
await palette(page, '新しいBOM'); await sleep(40)
await page.getByTestId('wizard-id').fill('P-RD'); await page.keyboard.press('Enter')
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
await page.keyboard.press('2'); await sleep(60)
const t0 = Date.now()
await page.getByTestId('wizard-file').setInputFiles(f)
let toast = ''
for (let i = 0; i < 1200; i++) { toast = await toastNow(page).catch(() => ''); if (/読み込みました|読めませんでした/.test(toast)) break; await sleep(100) }
const tLoad = Date.now() - t0
const t1 = Date.now()
await page.keyboard.press('Enter')
// 画面が応答するまで（evaluate が返るまで）
await page.evaluate(() => 1)
const tResp = Date.now() - t1
const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 120000 }).catch(() => '')) ?? ''
const out = { N, loadMs: tLoad, toast: toast.slice(0, 80), enterThenResponsiveMs: tResp, previewAfterMs: Date.now() - t1, preview: prev.replace(/\s+/g, ' ').slice(0, 160), errs: errors.filter((e) => e.type !== 'dialog').slice(0, 2).map((e) => e.text.slice(0, 100)) }
console.log(JSON.stringify(out))
saveJson(`221-redos-section-wizard-${process.env.TAG ?? '5176'}-${N}.json`, out)
await browser.close()
