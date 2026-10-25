// ラウンド17: 124-big17-make の 300 行のファイルをガイド「2 ファイル」で、b1・b2 の文字はガイド「1 貼り付け」でも。現行（5176）と r16 ビルド（5198）
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib20.mjs'
const DL = '/home/user/BOM/usertest/veteran/r20/dl/'
const TAG = process.env.TAG ?? ''
const FILES = ['b1-csv-raw-ditto-every10-300.csv', 'b2-tsv-ditto-last-first-300.tsv', 'b3-vtitle-eda-300.xlsx', 'b4-units-spare-300.xlsx', 'b5-complete-third-deleted-30.xlsx', 'b6-sparse-25-of-30.xlsx']
const { browser, page, errors } = await launch({ launch: {} })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
const out = []
const summarize = async () => {
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId); const rs = p?.rows ?? []
  const line = (r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')
  return { rows: rs.length, qtySum: rs.reduce((a, r) => a + (r.qtyNeeded ?? 0), 0), qty0: rs.filter((r) => r.qtyNeeded === 0).length, noName: rs.filter((r) => !(r.name ?? '').trim()).length, longMaker: rs.filter((r) => (r.maker ?? '').length > 20).length, modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, first: rs.slice(0, 3).map(line), odd: rs.filter((r) => (r.maker ?? '').length > 20 || !(r.name ?? '').trim()).slice(0, 3).map((r) => line(r).slice(0, 160)) }
}
for (const mode of ['file', 'paste']) for (const f of FILES) {
  if (mode === 'paste' && !/^b[12]-/.test(f)) continue
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-B' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  const n0 = errors.length
  let toast = ''
  if (mode === 'file') {
    await page.keyboard.press('2'); await sleep(60)
    await page.getByTestId('wizard-file').setInputFiles(DL + f)
    for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
    toast = (await toastNow(page)).slice(0, 400)
    if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  } else {
    await page.keyboard.press('1'); await sleep(60)
    await page.evaluate((t) => navigator.clipboard.writeText(t), fs.readFileSync(DL + f, 'utf8'))
    await page.getByTestId('wizard-paste').focus(); await page.keyboard.press('Control+v'); await sleep(150)
    await page.keyboard.press('Control+Enter'); await sleep(400)
  }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) { await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {}); created = await summarize() }
  const rec = { mode, f, toast, preview: prev.slice(0, 500), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1500))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`124-big17${TAG}.json`, out)
await browser.close()
