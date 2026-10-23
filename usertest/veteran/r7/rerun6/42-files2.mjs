// ラウンド5: 壊れた・変わったファイル（その 2）。ガイドの「ファイルから」に読ませる
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, panel, toastNow, DL, ws, dumpErrors, save } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
fs.mkdirSync(DL, { recursive: true })
const P = (f) => path.join(DL, f)
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['分類', '部品名', '型式', 'メーカ', '員数']); s.addRow(['電源', '電源ユニット', 'S8VK', 'オムロン', 2]); s.addRow(['', 'リレー', 'MY4N', 'オムロン', 3])
  await wb.xlsx.writeFile(P('ok.xlsx'))
  const buf = fs.readFileSync(P('ok.xlsx'))
  fs.writeFileSync(P('truncated.xlsx'), buf.subarray(0, Math.floor(buf.length / 2)))
  fs.writeFileSync(P('garbage.xlsx'), 'PK\x03\x04 this is not a zip at all')
  fs.writeFileSync(P('json-as.xlsx'), JSON.stringify({ projects: [] }))
  fs.writeFileSync(P('fake.xls'), Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]))
}
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  const hdr = ['部品名', '型式', 'メーカ', '員数']; for (let i = 0; i < 300; i++) hdr.push('列' + i)
  s.addRow(hdr); for (let r = 0; r < 10; r++) { const row = ['部品' + r, 'M' + r, 'オムロン', 1]; for (let i = 0; i < 300; i++) row.push('x' + i); s.addRow(row) }
  await wb.xlsx.writeFile(P('wide300.xlsx'))
}
{
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow([{ richText: [{ text: '部品' }, { text: '名' }] }, '型式', 'メーカ', '員数'])
  s.addRow(['リレー', { formula: '1/0', result: { error: '#DIV/0!' } }, 'オムロン', { formula: 'A1', result: { error: '#REF!' } }])
  s.addRow(['ヒューズ', 'F-1', null, 2]); s.addRow([null, null, null, null]); s.addRow(['端子', 'T-1', 'ニチフ', -3]); s.addRow(['電線', 'W-1', 'x', 1e12])
  await wb.xlsx.writeFile(P('errors.xlsx'))
}
{
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('空'); const s = wb.addWorksheet('部品表')
  s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 2])
  await wb.xlsx.writeFile(P('empty-first-sheet.xlsx'))
}
fs.writeFileSync(P('quoted-newline.csv'), '部品名,型式,メーカ,員数\r\n"リレー\r\n（2 行目）",MY4N,オムロン,2\r\n"カンマ, 入り","A,B",オムロン,1\r\n')
fs.writeFileSync(P('bom-only.csv'), '\ufeff')
fs.writeFileSync(P('one-col.csv'), '部品名\nリレー\nヒューズ\n')
{ const l = ['部品名,型式,メーカ,員数']; for (let i = 0; i < 300; i++) l.push(`"部品${i}",M-${i},オムロン,${i % 5 + 1}`); l.push('"閉じない引用,M-x,オムロン,1'); fs.writeFileSync(P('unclosed-quote.csv'), l.join('\n')) }
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
for (const f of (process.env.ONLYF ? process.env.ONLYF.split(',') : ['ok.xlsx', 'truncated.xlsx', 'garbage.xlsx', 'json-as.xlsx', 'fake.xls', 'wide300.xlsx', 'errors.xlsx', 'empty-first-sheet.xlsx', 'quoted-newline.csv', 'bom-only.csv', 'one-col.csv', 'unclosed-quote.csv'])) await tryWizard(f)
save('42-files2.json', out)
dumpErrors(errors, '42')
await browser.close()
