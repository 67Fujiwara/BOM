// ラウンド12: 合計のセル（「合計 …数字… kg」）で取り込みのプレビューが止まるか（isTotalCell の入れ子の繰り返し）
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r21/dl', f)
const H = ['部品名', '型式', 'メーカ', '員数']
const cases = [['n00', '合計 12 kg'], ['n22', '合計 ' + '1'.repeat(22) + ' kg'], ['n25', '合計 ' + '1'.repeat(25) + ' kg'], ['n27', '合計 ' + '1'.repeat(27) + ' kg'], ['n29', '合計 ' + '1'.repeat(29) + ' kg'], ['usd', '合計金額 ¥1,234,567,890,123,456,789,012 USD']]
for (const [k, cell] of cases) { const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', 'MY4N', 'オムロン', 12]); s.addRow([cell, '', '', '']); await wb.xlsx.writeFile(P(`redos-${k}.xlsx`)) }
const { browser, page, errors } = await launch()
const out = []
for (const [k, cell] of cases) {
  await fresh(page); await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-R' + k); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(`redos-${k}.xlsx`))
  for (let i = 0; i < 1200; i++) { if (/読み込みました|読めません/.test(await toastNow(page).catch(() => ''))) break; await sleep(100) }
  console.log(k, 'loaded', Date.now() - t0)
  const t1 = Date.now()
  // ページが応答するまでの時間（プレビューを作る間は止まる）
  await page.keyboard.press('Enter')
  const t2 = Date.now(); await page.waitForFunction(() => /取り込む行/.test(document.querySelector('[data-testid="wizard-preview"]')?.textContent ?? ''), null, { timeout: 120000, polling: 50 }).catch((e) => console.log('wait fail', String(e).slice(0, 80))); const t3 = Date.now()
  const probe = await page.evaluate(() => new Promise((r) => { const s = performance.now(); setTimeout(() => r(performance.now() - s), 0) }))
  const prev = ((await page.getByTestId('wizard-preview').textContent().catch(() => '')) ?? '').slice(0, 300)
  const rec = { k, cell, loadMs: t1 - t0, previewMs: t3 - t2, probe, prev }
  out.push(rec); console.log(JSON.stringify(rec))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`49-redos-wizard${process.env.TAG ?? ''}.json`, out)
await browser.close()
