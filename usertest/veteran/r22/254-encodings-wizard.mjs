// ラウンド21: 文字コード（Shift_JIS・UTF-8 BOM・UTF-16LE）× 複数行セル・コンマ入りの CSV / TSV をガイド「2 ファイル」で
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const DL = '/home/user/BOM/usertest/veteran/r22/dl/'
const { browser, page, errors } = await launch()
const out = []
for (const [f, expect] of [['f1-utf16le-refs.txt', 10], ['f2-utf16le-simple.txt', 10], ['f3-utf16le-comma-maker.txt', 10], ['f4-sjis-tsv-refs.tsv', 10], ['f5-sjis-csv-refs.csv', 10], ['f6-utf8bom-tsv-refs.tsv', 10], ['f7-utf16le-ml.txt', 8], ['f8-sjis-tsv-comma-maker.tsv', 10], ['f9-utf16le-single-col.txt', 5], ['f10-utf16le-title.txt', 10]]) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-E'); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  await page.getByTestId('wizard-file').setInputFiles(DL + f)
  for (let i = 0; i < 300; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 160)
  let rows = null, sample = null
  if (/読み込みました/.test(toast)) {
    await page.keyboard.press('Enter'); await sleep(300)
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    rows = p?.rows.length; sample = p?.rows.slice(0, 2).map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note ?? ''].join(' / '))
  }
  const rec = { f, expect, toast, rows, sample }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson(`254-encodings-wizard${process.env.TAG ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
