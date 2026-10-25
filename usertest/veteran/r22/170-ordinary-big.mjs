// ラウンド20: 普通の BOM 2,500 行の .xlsx / .csv / .tsv をガイド「2 ファイル」で取り込み、行の中身を JSON に（現行と r19 ビルドで突き合わせる）
import fs from 'node:fs'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
const DL = '/home/user/BOM/usertest/veteran/r22/dl/'
const TAG = process.env.TAG ?? ''
const { browser, page, errors } = await launch()
const out = {}
for (const f of (process.env.FILES ?? 'o1-ordinary-2500.xlsx,o1-ordinary-2500.csv,o1-ordinary-2500.tsv,o2-refs-2500.xlsx,o2-refs-2500.tsv,o2-refs-2500.csv').split(',')) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-O1'); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(DL + f)
  for (let i = 0; i < 600; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 300)
  await page.keyboard.press('Enter'); await sleep(300)
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 5000 }).catch(() => '')) ?? ''
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 120000 }).catch(() => {})
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
  out[f] = { ms: Date.now() - t0, toast, rows: p?.rows.length, warn: prev.replace(/\s+/g, ' ').slice(0, 900), data: p?.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.unit, r.ref ?? '', r.note ?? '', r.category ?? ''].join('\u0001')) }
  console.log(f, out[f].rows, out[f].ms)
}
fs.writeFileSync(`${DL}170-ordinary-big${TAG}.json`, JSON.stringify(out))
console.log('errors', errors.filter((e) => e.type !== 'dialog').length)
await browser.close()
