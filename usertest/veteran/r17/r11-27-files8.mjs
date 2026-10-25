// ラウンド11: 新しい形の Excel（隠した列を読む新しい規則の境目・ページごとの見出し・隠したシート・取消線など）。ガイドの「ファイルから」
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib17.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r17/dl', f)
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const H = ['部品名', '型式', 'メーカ', '員数']
const D1 = ['リレー', 'MY4N-D2 DC24', 'オムロン', 12], D2 = ['端子台', 'XW2B-20G4', 'オムロン', 2]
// 1 表題欄に「台数 2台」（メーカの列の上）＋ 数量の列だけ隠す
await wbFile('title-daisu-qty-hidden.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品表 制御盤A', '', '台数 2台']); s.addRow([]); s.addRow(H); s.addRow(D1); s.addRow(D2); s.getColumn(4).hidden = true })
// 1b 表題欄に「数量：1 式」（部品名の列の上）＋ 数量の列だけ隠す
await wbFile('title-suryo-qty-hidden.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['数量：1 式（制御盤A）']); s.addRow(H); s.addRow(D1); s.addRow(D2); s.getColumn(4).hidden = true })
// 1c 対照: 表題欄なし ＋ 数量の列だけ隠す
await wbFile('qty-hidden-control.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品表 制御盤A']); s.addRow(H); s.addRow(D1); s.addRow(D2); s.getColumn(4).hidden = true })
// 2 型式の列だけ隠す・部品名の列だけ隠す・メーカだけ
await wbFile('model-hidden-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(D2); s.getColumn(2).hidden = true })
await wbFile('name-hidden-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(D2); s.getColumn(1).hidden = true })
// 3 隠した「型式」に値、見える「品番」は空
await wbFile('model-hidden-visible-empty.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '品番', '型式', 'メーカ', '員数']); s.addRow(['リレー', '', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', '', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(3).hidden = true })
// 4 ページごとの見出し（各ページの右端にページ番号）
await wbFile('page-headers-pageno.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 1; pg <= 3; pg++) { s.addRow([...H, '', `P.${pg}`]); s.addRow([`リレー${pg}`, `MY${pg}`, 'オムロン', pg]); s.addRow([`端子台${pg}`, `XW${pg}`, 'オムロン', pg * 10]); s.addRow([]) } })
// 4b ページごとの見出し＋表題（部品表 (1/3)）
await wbFile('page-headers-title.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 1; pg <= 3; pg++) { s.addRow([`部品表 (${pg}/3)`]); s.addRow(H); s.addRow([`リレー${pg}`, `MY${pg}`, 'オムロン', pg]); s.addRow([`端子台${pg}`, `XW${pg}`, 'オムロン', pg * 10]) } })
// 4c ページごとの見出し（2 ページ目以降は「員数」→「数量」と書き方が違う）
await wbFile('page-headers-variant.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); s.addRow(['部品名', '型式', 'メーカ', '数量']); s.addRow(D2) })
// 5 隠したシート（左）に古い BOM、見えるシート（右）が今の BOM
await wbFile('hidden-sheet-left.xlsx', (wb) => { const a = wb.addWorksheet('Sheet1'); a.state = 'hidden'; a.addRow(H); a.addRow(['旧リレー', 'OLD-1', 'オムロン', 99]); const b = wb.addWorksheet('BOM'); b.addRow(H); b.addRow(D1); b.addRow(D2) })
// 6 取消線の行（日本の BOM でよく使う「削除」の印）
await wbFile('strike-row.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(D1); const r = s.addRow(['削除した部品', 'DEL-1', 'X', 5]); r.font = { strike: true }; s.addRow(D2) })
// 7 数量の書き方（1,200 / １，２００ / 1.200 / 12pcs / 1e3 / -3 / 0）
await wbFile('qty-formats.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); const qs = ['1,200', '１，２００', '1.5', '12pcs', '1e3', '-3', '0', '12 (予備2)']; qs.forEach((q, i) => s.addRow([`部品${i}`, `PN-${i}`, 'X', q])) })
// 8 見出しが 31 行目（表題欄が長い）
await wbFile('header-row-31.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let i = 0; i < 30; i++) s.addRow([`表題 ${i}`]); s.addRow(H); s.addRow(D1); s.addRow(D2) })
// 9 隠した列が 2 つ（員数・数量）どちらも唯一の数量
await wbFile('two-hidden-qty.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow([...H, '数量']); s.addRow([...D1, 99]); s.addRow([...D2, 98]); s.getColumn(4).hidden = true; s.getColumn(5).hidden = true })
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
  for (let i = 0; i < 240; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(250) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 300)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, sample: p?.rows.slice(0, 8).map((r) => [r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, loadMs, toast, preview: prev.slice(0, 600), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1400))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of ['title-daisu-qty-hidden.xlsx', 'title-suryo-qty-hidden.xlsx', 'qty-hidden-control.xlsx', 'model-hidden-only.xlsx', 'name-hidden-only.xlsx', 'model-hidden-visible-empty.xlsx', 'page-headers-pageno.xlsx', 'page-headers-title.xlsx', 'page-headers-variant.xlsx', 'hidden-sheet-left.xlsx', 'strike-row.xlsx', 'qty-formats.xlsx', 'header-row-31.xlsx', 'two-hidden-qty.xlsx']) await tryWizard(f)
saveJson('27-files8.json', out)
await browser.close()
