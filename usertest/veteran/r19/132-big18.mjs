// ラウンド18: 132-big18-make の 300 行のファイルをガイド「2 ファイル」で、c1・c2 の文字はガイド「1 貼り付け」でも。現行（5176）と r17 ビルド（5198）
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib19.mjs'
const DL = '/home/user/BOM/usertest/veteran/r19/dl/'
const TAG = process.env.TAG ?? ''
const FILES = fs.readdirSync(DL).filter((f) => /^c\d-/.test(f)).sort()
const { browser, page, errors } = await launch({ launch: {} })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
const out = []
const summarize = async () => {
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId); const rs = p?.rows ?? []
  const line = (r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')
  return { rows: rs.length, qtySum: rs.reduce((a, r) => a + (r.qtyNeeded ?? 0), 0), qty0: rs.filter((r) => r.qtyNeeded === 0).length, noName: rs.filter((r) => !(r.name ?? '').trim()).length, longMaker: rs.filter((r) => (r.maker ?? '').length > 20).length, modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, notes: rs.filter((r) => (r.note ?? '').trim()).length, descNames: rs.filter((r) => /^(Capacitor|Resistor|Diode|LED)$/.test(r.name ?? '')).length, dnpMaker: rs.filter((r) => r.maker === 'DNP').length, first: rs.slice(0, 3).map(line), odd: rs.filter((r) => (r.maker ?? '').length > 20 || !(r.name ?? '').trim()).slice(0, 3).map((r) => line(r).slice(0, 160)) }
}
for (const mode of ['file', 'paste']) for (const f of FILES) {
  if (mode === 'paste' && !/^c[12]-/.test(f)) continue
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
saveJson(`132-big18${TAG}.json`, out)
await browser.close()
