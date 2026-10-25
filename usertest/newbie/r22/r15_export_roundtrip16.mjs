// ラウンド16（新人では初めて）: 見本の BOM を「Excelで出力」（社内用・保管用）→ 似た盤の新しい BOM のガイド「2 ファイル」でその xlsx を読む。
// 部品名・型式・メーカ・数量・回路記号・分類が元の BOM と同じか
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, palette } from './lib.mjs'
import { wizardFile, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r15_export_roundtrip16')
const OUT = '/home/user/BOM/usertest/newbie/r22/dl/'
async function exportPick(n, tag) {
  await palette(page, 'Excel'); await page.keyboard.press('Enter'); await sleep(200)
  log(`  [${tag}] panel: ${(await T.panelText(page))?.slice(0, 200)}`)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.keyboard.press(String(n)); await sleep(100)
  if ((await ui(page)).panel) await page.keyboard.press('Enter')
  const d = await dl; await sleep(300)
  log(`  [${tag}] toast: ${await T.toast(page)} | download: ${d ? d.suggestedFilename() : 'なし'}`)
  if (!d) return null
  const f = OUT + 'r15_' + tag + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  for (const ws of wb.worksheets) { const rows = []; ws.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join('|'))); log(`    sheet「${ws.name}」 ${rows.length} 行: ${rows.slice(0, 3).join(' / ').slice(0, 500)}`) }
  return f
}
await fresh(page)
const orig = await proj(page)
const key = (r) => `${r.category}|${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}`
const origKeys = orig.rows.filter((r) => r.status !== 'cancelled').map(key)
log(`orig rows=${orig.rows.length} (取消以外 ${origKeys.length})`)
for (const [n, tag] of [[1, 'internal'], [3, 'archive']]) {
  await fresh(page)
  const f = await exportPick(n, tag)
  if (!f) continue
  const { toast, pv } = await wizardFile(page, f)
  log(`  [${tag}] load toast: ${toast}`)
  log(`  [${tag}] preview: ${pv.slice(0, 900)}`)
  await shot(page, 'r15_' + tag + '_preview')
  await page.keyboard.press('Enter'); await sleep(400)
  const p = await proj(page)
  log(`  [${tag}] created rows=${p.rows.length} toast=${(await T.toast(page))?.slice(0, 400)}`)
  const got = p.rows.map(key)
  const miss = origKeys.filter((k) => !got.includes(k)); const extra = got.filter((k) => !origKeys.includes(k))
  log(`  [${tag}] 元にあって無い ${miss.length}: ${miss.slice(0, 6).join(' / ')}`)
  log(`  [${tag}] 元に無い ${extra.length}: ${extra.slice(0, 6).join(' / ')}`)
  log(`  [${tag}] first rows: ${rowsText({ rows: p.rows.slice(0, 4) })}`)
}
save(errors); await browser.close()
