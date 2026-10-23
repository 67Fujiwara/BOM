// ラウンド7: 新しい形のファイル（ガイドの「ファイルから」）と、JSON 読み込みの「ファイルを選ぶ」に UTF-8 BOM・UTF-16 の JSON
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, panel, toastNow, DL, ws, dumpErrors, save } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r7/dl3', f)
const tsv = '部品名\t型式\tメーカ\t員数\r\nリレー\tMY4N-D2 DC24\tオムロン\t12\r\n端子台\tXW2B-20G4\tオムロン\t2\r\n'
const le = Buffer.from(tsv, 'utf16le')
fs.writeFileSync(P('utf16le-nobom.txt'), le)
const be = Buffer.from(tsv, 'utf16le'); for (let i = 0; i < be.length; i += 2) { const t = be[i]; be[i] = be[i + 1]; be[i + 1] = t }
fs.writeFileSync(P('utf16be-bom.txt'), Buffer.concat([Buffer.from([0xfe, 0xff]), be]))
fs.writeFileSync(P('csv-formula-text.csv'), '部品名,型式,メーカ,員数\r\nリレー,"=CONCATENATE(""MY4N"",""-D2"")",オムロン,=2*6\r\n端子台,XW2B,オムロン,1e400\r\n')
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品名', '型式', 'メーカ', '員数'])
  s.addRow(['リレー', 'MY4N', 'オムロン', { formula: '1+1', result: 2 }])
  s.addRow(['端子台', 'XW2B', 'オムロン', { sharedFormula: 'D2', result: undefined }])
  s.addRow(['ヒューズ', { formula: 'VLOOKUP(A4,X:Y,2,0)', result: { error: '#N/A' } }, 'オムロン', { formula: '1/0', result: { error: '#DIV/0!' } }])
  s.addRow(['電源', { richText: [{ text: 'S8VK-' }, { font: { bold: true }, text: 'G06024' }] }, { text: 'オムロン', hyperlink: 'https://example.com' }, true])
  s.addRow(['抵抗', 'RK73', 'KOA', new Date(Date.UTC(2026, 0, 5))])
  await wb.xlsx.writeFile(P('cells-mixed.xlsx'))
}
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品表', '', '', '']); s.mergeCells('A1:D1'); s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 2]); s.addRow(['', '', '', '']); s.addRow(['合計', '', '', { formula: 'SUM(D3:D3)', result: 2 }])
  await wb.xlsx.writeFile(P('merged-title.xlsx'))
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
  const tl0 = Date.now(); for (let i = 0; i < 120; i++) { if (/読み込みました|読めませんでした/.test(await toastNow(page)) || /読み込み済み/.test(await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => ''))) break; await sleep(250) } console.log('loadMs', f, Date.now() - tl0)
  const toast = (await toastNow(page)).slice(0, 200)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(f === '5000.tsv' ? 1500 : 200) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  const stepText = prev ? '' : ((await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => '')).slice(-300).replace(/\n/g, ' | '))
  let created = null
  if (prev) {
    const t1 = Date.now(); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { ms: Date.now() - t1, rows: p?.rows.length, sample: p?.rows.slice(0, 10).map((r) => [r.category, r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, toast, preview: prev.slice(0, 260), stepText, created, ms: Date.now() - t0, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 900))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of ['utf16le-nobom.txt', 'utf16be-bom.txt', 'csv-formula-text.csv', 'cells-mixed.xlsx', 'merged-title.xlsx']) await tryWizard(f)
// JSON 読み込みの「ファイルを選ぶ」
await fresh(page); await page.keyboard.press('Control+s'); await sleep(50)
const text = await page.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
const j = JSON.parse(text); j.projects[0].name = 'JSON-FILE-TEST'
const js = JSON.stringify(j, null, 1)
fs.writeFileSync(P('ws-utf8.json'), js)
fs.writeFileSync(P('ws-utf8bom.json'), '\ufeff' + js)
fs.writeFileSync(P('ws-utf16le.json'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(js, 'utf16le')]))
fs.writeFileSync(P('ws-sjis-like.json'), Buffer.from(js.replace(/[^\x00-\x7f]/g, '?'), 'latin1'))
for (const f of ['ws-utf8.json', 'ws-utf8bom.json', 'ws-utf16le.json']) {
  await fresh(page)
  await palette(page, 'JSON を読み込む'); await sleep(60)
  await page.getByTestId('import-file').setInputFiles(P(f)); await sleep(300)
  const t1 = await toastNow(page)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(150)
  const p1 = await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')
  if (/置き換える/.test(p1)) { await page.keyboard.press('2'); await sleep(50); await page.keyboard.press('Enter'); await sleep(300) }
  const t2 = await toastNow(page)
  const w = await ws(page)
  const rec = { f, fileToast: t1.slice(0, 120), afterSubmit: t2.slice(0, 200), confirm: p1.slice(0, 80).replace(/\n/g, ' '), name: w?.projects?.[0]?.name }
  out.push(rec); console.log(JSON.stringify(rec))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
save('../72-files4.json', out)
dumpErrors(errors, '72')
await browser.close()
