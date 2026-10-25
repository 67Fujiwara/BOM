// ラウンド14: 相見積先の無い案件で購買が 6 を開く → 知らせ（U13-04 の修正）のとおり Ctrl+K「案件設定」→ 相見積先 を入れる → 6 で見積
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q07_no_supplier')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} view=${u.view} mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 160) ?? ''} | toast: ${await T.toast(page)}`) }
await fresh(page)
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) { await page.keyboard.press('Enter'); await sleep(40) }
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
await page.keyboard.press('Control+Enter'); await sleep(250); await st('published')
await setRole(page, 'purchasing'); await sleep(150)
await page.keyboard.press('Alt+6'); await sleep(150); await st('Alt+6')
await shot(page, 'q07_6_toast')
// 知らせのとおり Ctrl+K →「案件設定」
await palette(page, '案件設定'); log('  palette: ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 200))
await page.keyboard.press('Enter'); await sleep(200); await st('案件設定')
// 相見積先の行をマウスでクリック
const opts = page.getByTestId('settings').locator('.opt')
const n = await opts.count(); let k = -1
for (let i = 0; i < n; i++) if ((await opts.nth(i).innerText()).includes('相見積先')) k = i
log('  settings rows=' + n + ' 相見積先 at ' + k)
await opts.nth(k).click(); await sleep(150); await st('click 相見積先')
await shot(page, 'q07_settings_supplier')
// 新人は商社の名前を知っている（日本語の名前で打つ）
const ws = await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().ws.suppliers.map((s) => ({ id: s.id, name: s.name, tradable: s.tradable })) })
log('  master: ' + JSON.stringify(ws))
await page.getByTestId('settings-input').fill(`${ws[0].name}、${ws[1].name}`); await page.keyboard.press('Enter'); await sleep(150); await st('names Enter')
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter')
if (await T.panel(page) === 'prompt' || (await ui(page)).panel === 'prompt') { await page.keyboard.insertText('相見積先を追加'); await page.keyboard.press('Enter'); await sleep(200); await st('reason Enter') }
if ((await ui(page)).panel) { await page.keyboard.press('Escape'); await sleep(150); await st('Esc') }
let p = await proj(page); log('  supplierIds=' + JSON.stringify(p.supplierIds))
await page.keyboard.press('Alt+6'); await sleep(150); await st('6 again')
log('  cols: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
await shot(page, 'q07_6_after')
// 依頼していないのに単価を打つ
await sel(page, 'R001'); await gotoCol(page, '単価').catch(() => {}); await st('at R001')
await typeReal(page, '1200'); await page.keyboard.press('Enter'); await sleep(150); await st('1200 Enter')
p = await proj(page); log('  quotes: ' + JSON.stringify(p.quotes.map((q) => [q.rowId, q.supplierId, q.unitPrice])))
save(errors); await browser.close()
