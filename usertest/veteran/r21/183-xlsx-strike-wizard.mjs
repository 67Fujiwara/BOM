// ラウンド20: 取消線の行・隠した変更区分の列のある .xlsx をガイドで（165 の X1・X4 の 2 経路目）
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const DL = '/home/user/BOM/usertest/veteran/r21/dl/'
const mk = async (name, build) => { const wb = new ExcelJS.Workbook(); const sh = wb.addWorksheet('BOM'); build(sh); await wb.xlsx.writeFile(DL + name) }
await mk('x1-strike.xlsx', (ws) => { ws.addRow(['部品名', '型式', 'メーカ', '数量']); ws.addRow(['リレー', 'MY4N', 'オムロン', 2]); const r = ws.addRow(['タイマ', 'H3CR', 'オムロン', 1]); r.eachCell((c) => { c.font = { strike: true } }); ws.addRow(['端子台', 'XW2B', 'オムロン', 2]) })
await mk('x4-hidden-kind.xlsx', (ws) => { ws.addRow(['変更区分', '部品名', '型式', '数量']); ws.addRow(['追加', 'A', 'M-1', 1]); ws.addRow(['削除', 'B', 'M-2', 1]); ws.addRow(['変更', 'C', 'M-3', 1]); ws.getColumn(1).hidden = true })
const { browser, page, errors } = await launch()
const out = []
for (const f of ['x1-strike.xlsx', 'x4-hidden-kind.xlsx']) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-X' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  await page.getByTestId('wizard-file').setInputFiles(DL + f)
  for (let i = 0; i < 200; i++) { if (/読み込みました|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 200)
  await page.keyboard.press('Enter'); await sleep(300)
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? ''
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
  const rec = { f, toast, rows: p?.rows.length, names: p?.rows.map((r) => r.name).join(','), warn: prev.replace(/\s+/g, ' ').match(/⚠[^⚠]*/g)?.join(' ') ?? '' }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('183-xlsx-strike-wizard.json', out)
await browser.close()
