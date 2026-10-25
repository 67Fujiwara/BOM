// ラウンド18: PM が「設計変更は PM 承認が必要」を はい にする → 設計の新人が R030 の部品名を直して公開（変更セット）→ 打ち間違いに気づいて
// もう一度直して公開（承認前に 2 つ目の変更セット）→ PM が 7 で承認 → 購買が社内用 Excel の変更点を見る（M17-03 の直しを新人の操作で）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, sel, gotoCol, ui, proj, sleep, shot, setRole, palette, typeReal, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r33_supersede18')
const OUT = '/home/user/BOM/usertest/newbie/r18/results/'
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const pt = async () => ((await T.panelText(page)) ?? '-').slice(0, 300)
async function editField(label, val) {
  const items = await page.getByTestId('settings').locator('.opt').allTextContents()
  const i = items.findIndex((t) => t.includes(label))
  const cur = (await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().panel.index }))
  for (let k = cur; k < i; k++) await page.keyboard.press('ArrowDown')
  for (let k = cur; k > i; k--) await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText(val); await page.keyboard.press('Enter'); await sleep(200)
  log(`  [${label} ← ${val}] idx=${i} toast: ${(await T.toast(page))?.slice(0, 200)}`)
}
const subs = async () => { const p = await proj(page); return p.submissions.map((s) => `Rev${s.rev}${s.changeSet ? `[cs ${s.changeSet.reason} approved=${s.changeSet.approved} rej=${!!s.changeSet.rejected} sup=${s.changeSet.supersededBy ?? '-'}]` : ''}${s.revoked ? '(revoked)' : ''}:${s.rowIds.join(',')}`).slice(-4).join(' ') }
const r030 = async () => { const r = (await proj(page)).rows.find((x) => x.id === 'R030'); return `name=${r.name} working=${JSON.stringify(r.working ?? null)} pendingApproval=${JSON.stringify(r.pendingApproval ?? null)} pendingRev=${r.pendingRev ?? '-'} pm=${r.flags.pmPending}/${r.flags.pmReason ?? '-'} rev=${r.publishedRev}` }
async function editName(v) { await sel(page, 'R030'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await sleep(60); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(150) }
async function publishCs(tag) {
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  [${tag}] Ctrl+Enter panel: ${await pt()}`)
  await shot(page, 'r33_' + tag)
  if (await T.panel(page)) { await page.keyboard.press('2'); await sleep(150); log(`  2 -> panel: ${(await pt()).slice(0, 160)}`) }
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(300) }
  log(`  -> toast: ${await T.toast(page)} | panel ${await T.panel(page)}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
}
await step('1 PM: 案件設定 → 設計変更は PM 承認が必要 ← はい → Ctrl+Enter', async () => {
  await fresh(page, 'pm'); await sleep(150)
  await palette(page, '案件設定'); await page.keyboard.press('Enter'); await sleep(200)
  await editField('設計変更は PM 承認', 'はい')
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  Ctrl+Enter -> panel: ${await pt()} | toast ${await T.toast(page)}`)
  if (await T.panel(page)) { await page.keyboard.insertText('試行運用'); await page.keyboard.press('Enter'); await sleep(250) }
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  log(`  changeNeedsPmApproval=${(await proj(page)).settings.changeNeedsPmApproval} toast ${await T.toast(page)}`)
})
await step('2 設計: R030 部品名「Pilot lmap」→ 公開（理由 2）', async () => {
  await setRole(page, 'design'); await sleep(200)
  await editName('Pilot lmap')
  await publishCs('first')
  log('  ' + (await r030())); log('  subs: ' + (await subs()))
})
await step('3 設計: 打ち間違いに気づく → 「Pilot lamp」に直して もう一度公開（理由 2）', async () => {
  await clearToast(page)
  await editName('Pilot lamp')
  await publishCs('second')
  log('  ' + (await r030())); log('  subs: ' + (await subs()))
})
await step('4 PM: 7 要決定 → R030 → Alt+y で承認', async () => {
  await setRole(page, 'pm'); await sleep(250)
  log(`  view=${await T.view(page)} rows=${await T.rows(page)} hints=${(await T.hints(page)).slice(0, 160)}`)
  const ids = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
  log('  7 rows: ' + ids.join(','))
  await shot(page, 'r33_pm_view7')
  await sel(page, 'R030'); await sleep(150)
  log(`  status: ${(await T.status(page)).replace(/\s+/g, ' ').slice(0, 220)}`)
  await page.keyboard.press('Alt+y'); await sleep(300)
  log(`  Alt+y -> panel: ${await pt()} | toast ${await T.toast(page)}`)
  if (await T.panel(page)) { await page.keyboard.insertText('客先承認済み'); await page.keyboard.press('Enter'); await sleep(300); log(`  Enter -> toast ${await T.toast(page)} | panel ${await pt()}`) }
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  log('  ' + (await r030())); log('  subs: ' + (await subs()))
  const p = await proj(page); log('  decisions: ' + p.decisions.slice(-3).map((d) => `${d.kind}:${d.rowId ?? ''}:${d.reason}`).join(' / '))
  log(`  7 rows after: ${await T.rows(page)}`)
})
await step('5 購買: R030 を見る → Excel 1 社内 → 変更点シート', async () => {
  await setRole(page, 'purchasing'); await sleep(200)
  await sel(page, 'R030'); await sleep(100)
  log(`  R030 row: ${(await T.rowText(page, 'R030'))?.slice(0, 200)}`)
  await palette(page, 'Excel'); await page.keyboard.press('Enter'); await sleep(200)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.keyboard.press('1'); await sleep(100)
  if ((await ui(page)).panel) await page.keyboard.press('Enter')
  const d = await dl; await sleep(300)
  if (!d) return log('  no download')
  const f = OUT + 'r33_internal' + (process.env.REPRO ? '_r2' : '') + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  const ws = wb.worksheets.find((w) => /変更/.test(w.name))
  const rows = []; ws?.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join('|')))
  log(`  sheet ${ws?.name}: ` + rows.filter((r, i) => i === 0 || /R030/.test(r)).join(' // ').replace(/\d{4}-\d\d-\d\d \d\d:\d\d/g, 'DATE'))
})
save(errors); await browser.close()
