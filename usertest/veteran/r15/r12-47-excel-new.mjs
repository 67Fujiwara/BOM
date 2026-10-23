// ラウンド12: 新しい形の Excel（V11-03/04/05 の修正の境目: 見出しの 6 割の重なり・ページの表題・隠した列の判断を見出しの行で）
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib15.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r15/dl', f)
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const H = ['部品名', '型式', 'メーカ', '員数']
const D1 = ['リレー', 'MY4N-D2 DC24', 'オムロン', 12], D2 = ['端子台', 'XW2B-20G4', 'オムロン', 2]
// X1 見出しに数量の列が 2 つ: 隠した「数量」（古い値 99）と見えている「員数」（12）
await wbFile('x1-hidden-qty-visible-insu.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '数量', '備考', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 99, '', 12]); s.addRow(['端子台', 'XW2B', 'オムロン', 98, '', 2]); s.getColumn(4).hidden = true })
// X1b 対照: 隠した列なし（数量 99 と員数 12）
await wbFile('x1b-two-qty-visible.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '数量', '備考', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 99, '', 12]); s.addRow(['端子台', 'XW2B', 'オムロン', 98, '', 2]) })
// X2 未定の行（名称未定・型式未定・メーカ未定）
await wbFile('x2-tbd-rows.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(['名称未定', '型式未定', 'メーカ未定', 2]); s.addRow(['部品取付板', '品番未定', 'メーカ不問', 1]); s.addRow(D2) })
// X2b 3 列の BOM（部品名・型式・数量）に「部品取付板 / 品番未定」
await wbFile('x2b-tbd-3col.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '数量']); s.addRow(['リレー', 'MY4N', 12]); s.addRow(['部品取付板', '品番未定', 1]); s.addRow(['端子台', 'XW2B', 2]) })
// X3 表題欄に「品名: 制御盤A」「数量: 2台」→ 3 列の見出し
await wbFile('x3-title-2fields.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['品名：制御盤A', '', '数量：2台']); s.addRow([]); s.addRow(['部品名', '型式', '数量']); s.addRow(['リレー', 'MY4N', 12]); s.addRow(['端子台', 'XW2B', 2]) })
// X4 2 ページ目の見出しの列の順が違う（数量とメーカが入れ替わる）
await wbFile('x4-page2-reordered.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow([]); s.addRow(['部品名', '型式', '員数', 'メーカ']); s.addRow(['端子台', 'XW2B', 2, 'オムロン']) })
// X5 2 ページ目に No の列が増える（1 列ずれる）
await wbFile('x5-page2-shift.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(['No', ...H]); s.addRow([1, ...D2]) })
// X6 名前だけの部品「部品表ホルダー」「BOM ラベル」（ほかの列は空）
await wbFile('x6-name-only-buhinhyo.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(['部品表ホルダー A4']); s.addRow(['BOM ラベル']); s.addRow(['P2']); s.addRow(D2) })
// X7 合計のセルに長い数字（重い正規表現）
await wbFile('x7-long-total.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(D2); s.addRow(['合計 1234567890123456789012345 kg', '', '', '']) })
// X8 ページの見出し 3 回・各ページに「部品表 (n/3)」と「P.n」
await wbFile('x8-pages-title-pageno.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 1; pg <= 3; pg++) { s.addRow([`部品表 (${pg}/3)`, '', '', '', `P.${pg}`]); s.addRow(H); s.addRow([`リレー${pg}`, `MY${pg}`, 'オムロン', pg]); s.addRow([`端子台${pg}`, `XW${pg}`, 'オムロン', pg * 10]) } })
// X9 見出しが 2 段（上段「部品」「」、下段「名称」「型式」…）
await wbFile('x9-two-row-header.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品', '', 'メーカ', '数量']); s.addRow(['名称', '型式', '', '']); s.addRow(D1); s.addRow(D2) })
// X10 隠した「型式」+ 見えている空の「品番」（V11 §3-8 の再確認）
await wbFile('x10-hidden-model-visible-empty.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '品番', '型式', 'メーカ', '員数']); s.addRow(['リレー', '', 'MY4N', 'オムロン', 12]); s.addRow(['端子台', '', 'XW2B', 'オムロン', 2]); s.getColumn(3).hidden = true })
const { browser, page, errors } = await launch()
const out = []
async function tryWizard(f) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-H' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(250) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 400)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, sample: p?.rows.slice(0, 10).map((r) => [r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, loadMs, toast, preview: prev.slice(0, 700), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1600))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
const FILES = (process.env.FILES ?? 'x1-hidden-qty-visible-insu,x1b-two-qty-visible,x2-tbd-rows,x2b-tbd-3col,x3-title-2fields,x4-page2-reordered,x5-page2-shift,x6-name-only-buhinhyo,x7-long-total,x8-pages-title-pageno,x9-two-row-header,x10-hidden-model-visible-empty').split(',')
for (const f of FILES) await tryWizard(f + '.xlsx')
saveJson(`47-excel-new${process.env.TAG ?? ''}.json`, out)
await browser.close()
