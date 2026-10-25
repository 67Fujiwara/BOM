// ラウンド13: 新人がガイドで作った BOM（希望商社を入れずに Enter 連打）→ 公開（理由＋変更番号）→ 購買が 6 で見積を打つ → 採用 → PM → Ctrl+Z → リロード
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, setRole, palette, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v07_newbom_flow')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 200) ?? ''} | toast: ${await T.toast(page)}`) }
const qs = async (id) => { const p = await proj(page); return p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => `${q.supplierId}:${q.unitPrice}/${q.leadDays}/${q.moq}/${q.stock}`).join(' ') }
const rs = async () => { const p = await proj(page); return p.rows.map((r) => `${r.id}:${r.status}:${r.name}/${r.model}/${r.qtyNeeded}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}`).join(' ') }
await fresh(page)
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) { await page.keyboard.press('Enter'); await sleep(40) }
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2\n端子台\tTB-12\tIDEC\t3')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300); await st('created')
let p = await proj(page); log('  project', p.id, 'suppliers', JSON.stringify(p.supplierIds), 'rows', await rs())
await page.keyboard.press('Control+Enter'); await sleep(150); await st('Ctrl+Enter')
for (const k of ['1', 'Tab']) { await page.keyboard.press(k); await sleep(60) }
await typeReal(page, 'ECN-2026-03'); await page.keyboard.press('Enter'); await sleep(200); await st('published')
p = await proj(page); log('  sub', JSON.stringify(p.submissions.at(-1)?.changeSet), 'rows', await rs())
// 購買
await setRole(page, 'purchasing'); await sleep(150); await st('purchasing')
await page.keyboard.press('Alt+6'); await sleep(150); await st('6')
log('  6 rows: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')).join(','))))
log('  cols: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
await shot(page, 'v07_purch6_nosupplier')
await sel(page, 'R001'); await sleep(80); await st('sel R001')
const ok = await gotoCol(page, '単価'); log('  gotoCol 単価', ok, await T.cursor(page))
await typeReal(page, '1200'); await page.keyboard.press('Enter'); await sleep(120); await st('typed 1200')
log('  quotes R001: ' + (await qs('R001')))
// 商社を足す方法を探す（Ctrl+K「商社」）
await palette(page, '商社'); log('  palette 商社: ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 300)); await page.keyboard.press('Escape')
await palette(page, '希望商社'); log('  palette 希望商社: ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 300)); await page.keyboard.press('Escape')
await runPalette(page, '商社', '商社を追加'); await sleep(150); await st('商社を追加')
await shot(page, 'v07_add_supplier')
if (await T.panel(page)) { await typeReal(page, 'ABC'); await page.keyboard.insertText('商事'); await page.keyboard.press('Enter'); await sleep(200); await st('ABC商事 Enter') }
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200); await st('Enter2') }
p = await proj(page); log('  suppliers now', JSON.stringify(p.supplierIds))
await page.keyboard.press('Alt+6'); await sleep(150)
log('  cols: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
await sel(page, 'R001'); await gotoCol(page, '単価'); await st('at 単価')
for (const v of ['1200', '14', '10']) { await typeReal(page, v, 15); await page.keyboard.press('ArrowRight'); await sleep(60); await st('typed ' + v) }
await page.keyboard.press('Escape'); await sleep(80)
log('  quotes R001: ' + (await qs('R001')) + ' | ' + (await rs()))
await shot(page, 'v07_after_quote')
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await st('reload')
log('  after reload quotes R001: ' + (await qs('R001')) + ' | ' + (await rs()))
save(errors); await browser.close()
