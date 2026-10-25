// ラウンド18: 140-shapes の形をガイド「2 ファイル」で取り込む（SHAPES は .xlsx、TEXTS は .csv / .tsv の文字のまま）。現行（BOM_URL 既定 5176）と r17 ビルド（5198）
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib20.mjs'
import { SHAPES, TEXTS } from './140-shapes.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r20/dl', f)
const TAG = process.env.TAG ?? ''
const files = []
for (const s of SHAPES) { const wb = new ExcelJS.Workbook(); const sh = wb.addWorksheet('BOM'); for (const r of s.rows) sh.addRow(r); await wb.xlsx.writeFile(P(`${s.id}.xlsx`)); files.push([s, `${s.id}.xlsx`]) }
for (const s of TEXTS) { const f = `${s.id}.${s.delim === 'csv' ? 'csv' : 'tsv'}`; fs.writeFileSync(P(f), s.text); files.push([s, f]) }
const { browser, page, errors } = await launch()
const out = []
for (const [s, f] of files.filter(([s]) => !process.env.ONLY || new RegExp(process.env.ONLY).test(s.id))) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-Q' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  await page.getByTestId('wizard-file').setInputFiles(P(f))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 500)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, sample: p?.rows.slice(0, 8).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), notes: p?.rows.slice(0, 8).map((r) => r.note ?? ''), qty0: p?.rows.filter((r) => r.qtyNeeded === 0).length }
  }
  const rec = { id: s.id, file: f, note: s.note, expect: s.expect, toast, preview: prev.slice(0, 600), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1500))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`140-header-wizard${TAG}.json`, out)
await browser.close()
