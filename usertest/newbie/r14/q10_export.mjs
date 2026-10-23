// ラウンド14: 新人が Excel を出す（これまで新人では試していない）: 設計が直してまだ公開していない行・ガイドで作ったばかりの BOM・購買の商社向け
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q10_export')
const OUT = '/home/user/BOM/usertest/newbie/r14/results/'
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
  const f = OUT + 'q10_' + tag + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  for (const ws of wb.worksheets) {
    const rows = []; ws.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join('|')))
    log(`    sheet「${ws.name}」 ${rows.length} 行: ${rows.slice(0, 4).join(' / ').slice(0, 400)}`)
    const hit = rows.filter((r) => /Lamp|LED-NEW|MY9X/.test(r)); if (hit.length) log(`    ★ 未公開の値を含む行: ${hit.join(' / ').slice(0, 300)}`)
  }
  return f
}
log('== A 設計: R030 の型式を MY9X に直す（未公開）→ Excel 社内 / 商社向け / 保管用')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('MY9X'); await page.keyboard.press('Enter'); await sleep(150)
await exportPick(1, 'A_design_internal')
await exportPick(2, 'A_design_supplier')
await exportPick(3, 'A_design_archive')
log('== B ガイドで作ったばかり（公開前）の BOM で 商社向け')
await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
await exportPick(2, 'B_new_supplier')
log('== C 購買: 設計が R030 を直したまま（未公開）→ 購買が商社向け')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('MY9X'); await page.keyboard.press('Enter'); await sleep(150)
await setRole(page, 'purchasing'); await sleep(150)
await exportPick(2, 'C_purch_supplier')
await exportPick(1, 'C_purch_internal')
save(errors); await browser.close()
