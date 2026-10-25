// 購買 6 で見積中の行に 3 社分を横に打つ（→ / Tab）→ 設計が採用（2 位）→ PM の 7 → y → Ctrl+Z → リロード
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y10_quote_adopt_pm')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 260) ?? ''} | toast: ${await T.toast(page)}`) }
const qs = async (id) => { const p = await proj(page); return p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => `${q.supplierId}:${q.unitPrice}/${q.leadDays}/${q.moq}/${q.stock}/${q.validUntil}`).join(' ') }
await fresh(page)
await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(200); log('publish: ' + (await T.toast(page)))
await setRole(page, 'purchasing'); await sleep(100)
let p = await proj(page)
const quoting = p.rows.filter((r) => r.status === 'quoting' || r.status === 'submitted').map((r) => r.id + ':' + r.status)
log('quoting rows: ' + quoting.join(','))
log('suppliers: ' + p.supplierIds.join(','))
const id = quoting[0].split(':')[0]
await page.keyboard.press('Alt+6'); await sleep(100); await sel(page, id); await gotoCol(page, '単価'); await st('at')
log('  cols: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
log('  before ' + (await qs(id)))
// 1 社目: 単価 → 納期 → MOQ → 在庫 → 有効期限 → （次の商社の単価）
const seq = ['1200', '14', '10', 'zaiko', '12/31', '1150', '21', '1', 'toriyose', '12/31', '1300', '7']
for (const v of seq) { await typeReal(page, v, 15); await page.keyboard.press('ArrowRight'); await sleep(50); const u = await ui(page); log(`   typed ${v} → now ${u.cursorCol} mode=${u.mode} toast=${await T.toast(page)}`) }
await page.keyboard.press('Escape')
log('  after ' + (await qs(id)) + ' | status ' + (await row(page, id)).status)
await shot(page, 'y10_6_row')
// 設計: 採用
await setRole(page, 'design'); await sleep(100); await sel(page, id); await st('design at row')
await page.keyboard.press('Alt+Shift+A'); await sleep(100); await st('Alt+Shift+A')
await page.keyboard.press('3'); await sleep(100); await st('3 (3 位)')
await page.keyboard.press('1'); await typeReal(page, 'tanki'); await page.keyboard.press('Enter'); await sleep(150); await st('1 tanki Enter')
let r = await row(page, id); log('  row', r.status, r.adoptedSupplierId, JSON.stringify(r.flags), r.adoptReason ?? '')
// PM
await setRole(page, 'pm'); await sleep(150); await st('pm')
const in7 = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')).join(','))
log('  7 rows: ' + in7)
if (in7.includes(id)) {
  await sel(page, id); await page.keyboard.press('y'); await sleep(100); await st('y')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
  r = await row(page, id); log('  after y', r.status, r.adoptedSupplierId, JSON.stringify(r.flags))
  await page.keyboard.press('Control+z'); await sleep(150); await st('Ctrl+Z')
  r = await row(page, id); log('  after undo', r.status, r.adoptedSupplierId, JSON.stringify(r.flags))
  await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await st('reload')
  r = await row(page, id); log('  after reload', r.status, r.adoptedSupplierId, JSON.stringify(r.flags))
}
save(errors); await browser.close()
