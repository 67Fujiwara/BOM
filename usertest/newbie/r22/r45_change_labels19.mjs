// ラウンド19: U18-02 の直し（社内用 Excel の「変更点」を列の名前で書く）を新人の操作で。設計の新人が 1 行に 1 項目ずつ、
// いろいろな列を変えて公開（理由 2）→ 購買の新人が 5 変更あり と 社内用 Excel の「変更点」を読む。変更点に出ない項目はないか
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, sel, gotoCol, ui, proj, sleep, shot, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r45_change_labels19')
const OUT = '/home/user/BOM/usertest/newbie/r22/dl/'
const R2 = process.env.REPRO ? '_r2' : ''
const edits = [
  ['R030', '規格', 'IP65'], ['R031', '入数', '2'], ['R032', '必要日(固定)', '2026-11-10'], ['R033', '備考', '盤内上段に変更'],
  ['R036', '回路記号', 'K36'], ['R037', '図面番号', 'E-2026-041-09'], ['R038', '調達区分', '支給品'], ['R039', '必要日(前倒し)', '7'],
  ['R040', '代替可否', '不可'], ['R042', 'メーカ指定', '指定'], ['R043', '単位', 'm'], ['R044', '分類', '端子'], ['R046', '指定先', 'S2'],
  ['R047', '部品名', '端子台カバー'], ['R048', '必要数', '20'],
]
const ids = edits.map((e) => e[0])
const showCols = ['図面番号', '入数', 'メーカ指定', '指定先', '必要日(前倒し)', '必要日(固定)', '規格']
async function exportInternal(tag) {
  await palette(page, 'Excel'); await page.keyboard.press('Enter'); await sleep(200)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.keyboard.press('1'); await sleep(100)
  if ((await ui(page)).panel) await page.keyboard.press('Enter')
  const d = await dl; await sleep(300)
  log(`  [${tag}] toast: ${await T.toast(page)} | download: ${d ? d.suggestedFilename() : 'なし'}`)
  if (!d) return
  const f = OUT + 'r45_' + tag + R2 + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  const ws = wb.worksheets.find((w) => /変更/.test(w.name))
  if (!ws) { log('    変更点シートなし: ' + wb.worksheets.map((w) => w.name).join(',')); return }
  const rows = []; ws.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join('|')))
  log(`    sheet「${ws.name}」 header: ${rows[0]}`)
  for (const id of ids) { const hit = rows.filter((r) => r.includes('|' + id + '|')); log(`    ${id}: ${hit.length ? hit.map((h) => h.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/, '')).join(' / ').slice(0, 300) : '（変更点の行なし）'}`) }
}
log('== 設計: 隠れている列を Ctrl+K「列の表示」でマウスで出す')
await fresh(page); await sleep(150); await page.keyboard.press('1'); await sleep(100)
await palette(page, '列の表示'); await page.keyboard.press('Enter'); await sleep(200)
for (const c of showCols) { const o = page.getByTestId('columns').locator('.opt').filter({ hasText: new RegExp('^\\s*[○●]\\s*' + c.replace(/[()]/g, '\\$&')) }); if ((await o.count()) && (await o.first().innerText()).includes('○')) { await o.first().click(); await sleep(80) } }
log('  columns: ' + (await page.getByTestId('columns').innerText()).replace(/\s+/g, ' ').slice(0, 400))
await page.keyboard.press('Escape'); await sleep(150)
log('== 設計: 1 行に 1 項目ずつ Enter → 打つ → Enter')
for (const [id, col, val] of edits) {
  await sel(page, id); const ok = await gotoCol(page, col)
  if (!ok) { log(`  ${id} ${col}: 列が見つからない`); continue }
  await page.keyboard.press('Enter'); await sleep(60); await page.keyboard.press('Control+a'); await page.keyboard.insertText(val); await sleep(50); await page.keyboard.press('Enter'); await sleep(150)
  const r = (await proj(page)).rows.find((x) => x.id === id)
  log(`  ${id} ${col} ← ${val}: working=${JSON.stringify(r.working ?? null)} | toast ${(await T.toast(page))?.slice(0, 120)}`)
}
await shot(page, 'r45_design_edits')
log('== 設計: Ctrl+Enter → 理由 2 → Enter')
await page.keyboard.press('Control+Enter'); await sleep(250)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 200))
if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(300) }
log('  toast: ' + (await T.toast(page)))
const p = await proj(page); const sub = p.submissions.at(-1)
log(`  Rev.${sub.rev} rowIds=${sub.rowIds.join(',')} causes=${JSON.stringify(sub.causes)}`)
log('  not published: ' + ids.filter((id) => !sub.rowIds.includes(id)).map((id) => `${id}:${JSON.stringify(p.rows.find((x) => x.id === id).working ?? null)}`).join(' '))
log('== 購買: 5 変更あり の行と、社内用 Excel の変更点')
await setRole(page, 'purchasing'); await sleep(250); await page.keyboard.press('Alt+5'); await sleep(250)
const v5 = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id') + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 140)))
for (const id of ids) log('  v5 ' + (v5.find((x) => x.startsWith(id + ':')) ?? id + ': （ビュー 5 になし）'))
await shot(page, 'r45_purch_v5')
await exportInternal('purch_internal')
await setRole(page, 'design'); await sleep(200)
await exportInternal('design_internal')
save(errors); await browser.close()
