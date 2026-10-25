// ラウンド13: 60-shapes の形を Excel（.xlsx）にして、ガイド「ファイルから」で実際に取り込む。現行（PORT 5176）と r12 ビルド（5198）
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib18.mjs'
import { SHAPES } from './r13-60-shapes.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r18/dl', f)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const TAG = process.env.TAG ?? ''
const SHOT = process.env.SHOT ? process.env.SHOT.split(',') : []
for (const s of SHAPES) { if (ONLY && !ONLY.includes(s.id)) continue; const wb = new ExcelJS.Workbook(); const sh = wb.addWorksheet('BOM'); for (const r of s.rows) sh.addRow(r); await wb.xlsx.writeFile(P(`${s.id}.xlsx`)) }
const { browser, page, errors } = await launch()
const out = []
for (const s of SHAPES) {
  if (ONLY && !ONLY.includes(s.id)) continue
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-H' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  await page.getByTestId('wizard-file').setInputFiles(P(`${s.id}.xlsx`))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(250) }
  const toast = (await toastNow(page)).slice(0, 500)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if (SHOT.includes(s.id)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r18/shots/${s.id}${TAG}-preview.png` })
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, sample: p?.rows.slice(0, 8).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), qty0: p?.rows.filter((r) => r.qtyNeeded === 0).length }
  }
  const rec = { id: s.id, note: s.note, expect: s.expect, toast, preview: prev.slice(0, 600), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1800))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`61-header-wizard${TAG}.json`, out)
await browser.close()
