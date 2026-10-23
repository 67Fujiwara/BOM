// ラウンド15: 小計・合計の判定（isTotalCell）の正規表現の入れ子の繰り返し。「合計」＋数字 N 桁＋数字でない 1 字のセルを 1 つ含む .xlsx をガイドで読む時間
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib16.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r16/dl', f)
const TAG = process.env.TAG ?? ''
const NS = (process.env.NS ?? '20,24,26,28').split(',').map(Number)
for (const n of NS) { const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '数量', '備考']); s.addRow(['リレー', 'MY4N', 'オムロン', 12, '']); s.addRow(['端子台', 'XW2B', 'オムロン', 2, '計' + '1'.repeat(n) + 'x']); await wb.xlsx.writeFile(P(`y-total-${n}.xlsx`)) }
const { browser, page, errors } = await launch()
const out = []
for (const n of NS) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-Y' + n); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(`y-total-${n}.xlsx`))
  for (let i = 0; i < 2400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page).catch(() => ''))) break; await sleep(100) }
  const loadMs = Date.now() - t0
  const t1 = Date.now(); await page.keyboard.press('Enter'); await page.getByTestId('wizard-preview').waitFor({ timeout: 240000 }).catch(() => {}); const previewMs = Date.now() - t1
  const rec = { n, loadMs, previewMs, errs: errors.filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`105-redos-xlsx${TAG}.json`, out)
await browser.close()
