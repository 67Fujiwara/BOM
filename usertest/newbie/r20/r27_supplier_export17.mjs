// ラウンド17: 設計の新人が調達区分を Excel の書き方で「支給」「在庫」と打つ → 公開 → 購買の新人が商社向け Excel（全商社共通・商社ごと）を出す。
// M16-09 の直し（商社向けに支給品・社内在庫を出さない）を新人の操作で。比べ: 社内用には出るか
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, sel, gotoCol, ui, proj, sleep, shot, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r27_supplier_export17')
const OUT = '/home/user/BOM/usertest/newbie/r20/dl/'
async function exportPick(n, tag) {
  await palette(page, 'Excel'); await page.keyboard.press('Enter'); await sleep(200)
  log(`  [${tag}] panel: ${(await T.panelText(page))?.slice(0, 300)}`)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.keyboard.press(String(n)); await sleep(100)
  if ((await ui(page)).panel) await page.keyboard.press('Enter')
  const d = await dl
  await sleep(300)
  log(`  [${tag}] toast: ${await T.toast(page)} | download: ${d ? d.suggestedFilename() : 'なし'}`)
  if (!d) return null
  const f = OUT + 'r27_' + tag + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  for (const ws of wb.worksheets) {
    const rows = []; ws.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join('|')))
    const hit = rows.filter((r) => /\bR020\b|\bR021\b/.test(r))
    log(`    sheet「${ws.name}」 ${rows.length} 行。R020/R021: ${hit.length ? hit.join(' / ').slice(0, 300) : 'なし'}`)
  }
  return f
}
const cell = async (id, col, val) => { await sel(page, id); const ok = await gotoCol(page, col); log(`  col ${col} visible=${ok}`); await page.keyboard.press('Enter'); await sleep(60); await page.keyboard.insertText(val); await sleep(50); await page.keyboard.press('Enter'); await sleep(150); log(`  ${id} ${col} ← ${val}: toast ${(await T.toast(page))?.slice(0, 140)}`) }
log('== 設計: R020 の調達区分に「支給」、R021 に「在庫」と打つ → Ctrl+Enter → 理由 1 → Enter')
await fresh(page); await sleep(150); await page.keyboard.press('1'); await sleep(100)
await cell('R020', '調達区分', '支給')
await cell('R021', '調達区分', '在庫')
let p = await proj(page); for (const id of ['R020', 'R021']) { const r = p.rows.find((x) => x.id === id); log(`  ${id}: procurement=${r.procurement} working=${JSON.stringify(r.working)}`) }
await page.keyboard.press('Control+Enter'); await sleep(250)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 160))
if (await T.panel(page)) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); await sleep(300) }
log('  toast: ' + (await T.toast(page)))
p = await proj(page); for (const id of ['R020', 'R021']) { const r = p.rows.find((x) => x.id === id); log(`  ${id}: procurement=${r.procurement} status=${r.status} rev=${r.publishedRev}`) }
await setRole(page, 'purchasing'); await sleep(200)
log('== 購買: Excel → 2 商社向け（全商社共通）/ 4 因幡電機 / 1 社内')
await exportPick(2, 'supplier_all')
await exportPick(4, 'supplier_S1')
await exportPick(1, 'internal')
p = await proj(page); for (const id of ['R020', 'R021']) { const r = p.rows.find((x) => x.id === id); log(`  ${id}: status=${r.status} adopted=${r.adoptedSupplierId ?? '-'} quotes=${p.quotes.filter((q) => q.rowId === id && !q.stale).length}`) }
log('== 購買: 概算見積を依頼 → Enter（支給品・社内在庫の行に依頼が行くか）')
await palette(page, '概算見積を依頼'); await page.keyboard.press('Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(400)
log('  toast: ' + (await T.toast(page)))
p = await proj(page); for (const id of ['R020', 'R021']) { const r = p.rows.find((x) => x.id === id); log(`  ${id}: status=${r.status} quotes=${p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId + ':' + (q.unitPrice ?? '-')).join(' ')}`) }
save(errors); await browser.close()
