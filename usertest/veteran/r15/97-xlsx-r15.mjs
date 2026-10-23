// ラウンド15: 大きい・結合セルのある .xlsx（ラウンド14 の修正の境目）をガイド「ファイルから」で。現行（BOM_URL 既定 5176）と r14 ビルド（5198）
// x1 ページの表題を 2 行×4 列に結合 / x2 「以下余白」を 2 行×4 列に結合 / x3 メーカを縦に 10 行結合 / x4 数量を縦に 2 行結合
// x5 メーカに ASCII の「"」（〃の代わり）/ x6 型式が「"」で始まる / x7 変えた行だけ変更後型式＋追加 1 行（300 行）
// x8 見積書の見出し（品名・仕様・数量・単価・金額）300 行 / x9 設計変更の様式をページごとに繰り返す 300 行 / x10 上の段「部品名・旧・新」をページごと
// x11 区切りの行「■ 制御部」を 2 行×6 列に結合
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib15.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r15/dl', f)
const TAG = process.env.TAG ?? ''
const MK = ['オムロン', '三菱電機', 'IDEC']
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM'); await build(s); await wb.xlsx.writeFile(P(name + '.xlsx')) }
const H = ['部品名', '型式', 'メーカ', '数量']
const part = (k) => [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1]
await wbFile('x1-title-merged-2rows', (s) => { s.addRow(H); let r = 1; for (let k = 1; k <= 300; k++) { s.addRow(part(k)); r++; if (k % 50 === 0 && k < 300) { s.addRow([`部品表 (${k / 50 + 1}/6)`]); s.addRow([]); s.mergeCells(`A${r + 1}:D${r + 2}`); r += 2 } } })
await wbFile('x2-yohaku-merged', (s) => { s.addRow(H); for (let k = 1; k <= 20; k++) s.addRow(part(k)); s.addRow(['以下余白']); s.addRow([]); s.mergeCells('A22:D23') })
await wbFile('x3-maker-vmerged', (s) => { s.addRow(H); for (let k = 1; k <= 20; k++) s.addRow([`部品${k}`, `MDL-${k}`, k <= 10 ? 'オムロン' : '富士', 2]); s.mergeCells('C2:C11'); s.mergeCells('C12:C21') })
await wbFile('x4-qty-vmerged', (s) => { s.addRow(H); s.addRow(['リレー', 'MY4N', 'オムロン', 4]); s.addRow(['リレー(予備)', 'MY4N', 'オムロン', '']); s.mergeCells('D2:D3'); s.addRow(['端子台', 'XW2B', 'オムロン', 2]) })
await wbFile('x5-ascii-quote-ditto', (s) => { s.addRow(H); for (let k = 1; k <= 300; k++) s.addRow(k === 3 ? [`部品${k}`, `MDL-${k}`, '"', 3] : part(k)) })
await wbFile('x6-model-starts-quote', (s) => { s.addRow(H); for (let k = 1; k <= 300; k++) s.addRow(k === 3 ? [`部品${k}`, '"N"型コネクタ', 'オムロン', 3] : part(k)) })
await wbFile('x7-changed-only-plus-add', (s) => { s.addRow(['部品名', '型式', '変更後型式', '数量']); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `OLD-${k}`, k % 10 === 0 ? `NEW-${k}` : '', (k % 9) + 1]); s.addRow(['追加電源', '', 'NEW-S8VK', 1]) })
await wbFile('x8-quotation-300', (s) => { s.addRow(['品名', '仕様', '数量', '単価', '金額']); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `DC24V-${k}`, (k % 9) + 1, 100 * k, 100 * k * ((k % 9) + 1)]) })
await wbFile('x9-ecn-top-repeat-300', (s) => { let r = 0; for (let k = 1; k <= 300; k++) { if ((k - 1) % 50 === 0) { s.addRow(['', '変更前', '', '', '変更後', '', '']); r++; s.mergeCells(`B${r}:D${r}`); s.mergeCells(`E${r}:G${r}`); s.addRow(['部品名', '型式', 'メーカ', '数量', '型式', 'メーカ', '数量']); r++ } const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, MK[k % 3], (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, MK[k % 3], ch ? (k % 9) + 11 : (k % 9) + 1]); r++ } })
await wbFile('x10-kyushin-name-up-repeat-300', (s) => { let r = 0; for (let k = 1; k <= 300; k++) { if ((k - 1) % 50 === 0) { s.addRow(['部品名', '旧', '', '新', '']); r++; s.addRow(['', '型式', '数量', '型式', '数量']); r++; s.mergeCells(`A${r - 1}:A${r}`); s.mergeCells(`B${r - 1}:C${r - 1}`); s.mergeCells(`D${r - 1}:E${r - 1}`) } const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, ch ? (k % 9) + 11 : (k % 9) + 1]); r++ } })
await wbFile('x11-section-merged-2rows', (s) => { s.addRow(['部品名', '型式', 'メーカ', '数量', '単位', '備考']); s.addRow(['■ 制御部']); s.addRow([]); s.mergeCells('A2:F3'); for (let k = 1; k <= 10; k++) s.addRow([`部品${k}`, `MDL-${k}`, MK[k % 3], 2, '個', '']); s.addRow(['■ 端子部']); s.addRow([]); s.mergeCells('A14:F15'); for (let k = 11; k <= 20; k++) s.addRow([`部品${k}`, `MDL-${k}`, MK[k % 3], 2, '個', '']) })
const FILES = (process.env.FILES ?? 'x1-title-merged-2rows,x2-yohaku-merged,x3-maker-vmerged,x4-qty-vmerged,x5-ascii-quote-ditto,x6-model-starts-quote,x7-changed-only-plus-add,x8-quotation-300,x9-ecn-top-repeat-300,x10-kyushin-name-up-repeat-300,x11-section-merged-2rows').split(',')
const { browser, page, errors } = await launch()
const out = []
for (const f of FILES) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-X' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  await page.getByTestId('wizard-file').setInputFiles(P(f + '.xlsx'))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 600)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(f)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r15/shots/${f}${TAG}-preview.png` })
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    const rs = p?.rows ?? []
    const line = (r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')
    created = { rows: rs.length, qty0: rs.filter((r) => r.qtyNeeded === 0).length, notBuhin: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).map(line).slice(0, 8), notBuhinN: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).length, modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, sample: rs.slice(0, 4).map(line), around: rs.slice(48, 54).map(line), last: rs.slice(-3).map(line), makers: [...new Set(rs.map((r) => r.maker))].slice(0, 6) }
  }
  const rec = { f, toast, preview: prev.slice(0, 900), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 2500))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`97-xlsx-r15${TAG}.json`, out)
await browser.close()
