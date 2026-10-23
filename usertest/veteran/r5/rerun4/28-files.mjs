// ラウンド4: 壊れた・変わったファイル（空・Shift_JIS の CSV・5000 行・見出しだけ・結合セル・数式セル・巨大 JSON）
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, panel, toastNow, DL, ws, dumpErrors, save } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
fs.mkdirSync(DL, { recursive: true })
const P = (f) => path.join(DL, f)
fs.writeFileSync(P('empty.xlsx'), '')
fs.writeFileSync(P('empty.csv'), '')
fs.writeFileSync(P('header-only.csv'), '部品名,型式,メーカ,員数\n')
// Shift_JIS の CSV（Excel の既定の CSV 保存）: 「リレー,MY4N,オムロン,2」
// sjis.csv は iconv で作成（printf ... | iconv -f UTF-8 -t SHIFT_JIS > dl/sjis.csv）
fs.writeFileSync(P('bom-utf8.csv'), '﻿部品名,型式,メーカ,員数\r\nリレー,MY4N,オムロン,2\r\n')
{ const l = ['部品名\t型式\tメーカ\t員数']; for (let i = 0; i < 5000; i++) l.push(`部品${i}\tM-${i}\tオムロン\t1`); fs.writeFileSync(P('5000.tsv'), l.join('\n')) }
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['分類', '部品名', '型式', 'メーカ', '員数'])
  s.addRow(['電源', '電源ユニット', 'S8VK', 'オムロン', 2]); s.addRow(['', 'リレー', 'MY4N', 'オムロン', { formula: 'B1*0+3', result: 3 }])
  s.addRow(['', 'ヒューズ', { text: 'F-1', hyperlink: 'http://x' }, 'オムロン', 1]); s.addRow(['', '日付型式', new Date('2026-01-02'), 'x', 1])
  s.mergeCells('A2:A4')
  s.addRow(['制御', '=cmd|calc', '+SUM(1)', '-1', '1'])
  await wb.xlsx.writeFile(P('merged-formula.xlsx'))
}
async function tryWizard(f) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-F' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  const t0 = Date.now()
  if (await page.getByTestId('wizard-file').count()) { await page.getByTestId('wizard-file').setInputFiles(P(f)); }
  await sleep(f === '5000.tsv' ? 1500 : 600)
  const toast = (await toastNow(page)).slice(0, 200)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(f === '5000.tsv' ? 1500 : 200) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  const stepText = prev ? '' : ((await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => '')).slice(-300).replace(/\n/g, ' | '))
  let created = null
  if (prev) {
    const t1 = Date.now(); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { ms: Date.now() - t1, rows: p?.rows.length, sample: p?.rows.slice(0, 6).map((r) => [r.category, r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, toast, preview: prev.slice(0, 260), stepText, created, ms: Date.now() - t0, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 900))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of (process.env.ONLYF ? process.env.ONLYF.split(',') : ['empty.xlsx', 'empty.csv', 'header-only.csv', 'sjis.csv', 'bom-utf8.csv', '5000.tsv', 'merged-formula.xlsx'])) await tryWizard(f)
save('28-files.json', out)
dumpErrors(errors, '28')
await browser.close()
