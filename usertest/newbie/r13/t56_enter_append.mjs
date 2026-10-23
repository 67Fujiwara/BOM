// Enter（ステータスバーの「Enter 編集」）から打ち直すと、もとの値の後ろに足される。数字キーでビューを変えるつもりの打鍵
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t56_enter_append')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const qs = async (id) => { const p = await proj(page); return p.quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}`).join(' ') }
await step('A. 購買 6: R033 S1 単価 106 を Enter → 95 → Enter', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(150)
  await sel(page, 'R033'); for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
  log('  before', await qs('R033'), '| R033', (await row(page, 'R033')).status)
  await page.keyboard.press('Enter'); await typeReal(page, '95', 60); await state('typed'); await page.keyboard.press('Enter'); await sleep(150); await state('Enter')
  log('  after', await qs('R033'))
  await sel(page, 'R033'); await sleep(100); log('  row text', (await T.rowText(page, 'R033'))?.slice(0, 200))
  await page.keyboard.press('Space'); await sleep(150); await shot(page, 't56_A_price_10695'); log('  detail', (await page.locator('[data-testid="detail"]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300))
  await setRole(page, 'design')
})
await step('B. 設計: 起動 → ↓ → サイドの「4 要確認」のつもりで 4 → Enter', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(80); await state('↓')
  await page.keyboard.press('4'); await sleep(80); await state('4'); await page.keyboard.press('Enter'); await sleep(120); await state('Enter')
  const r = await row(page, 'R001'); log('  R001', r.name, JSON.stringify(r.working ?? null))
  await page.keyboard.press('Control+Enter'); await sleep(200); log('  Ctrl+Enter', await T.toast(page), (await T.panelText(page))?.slice(0, 100))
  await shot(page, 't56_B_name_4')
})
await step('C. 設計: 6 で商社別 → 続けて 4（要確認に戻るつもり）', async () => {
  await fresh(page); await page.keyboard.press('6'); await sleep(100); await state('6'); await page.keyboard.press('4'); await sleep(100); await state('4'); await page.keyboard.press('Enter'); await sleep(100); await state('Enter')
  const ws = await proj(page); const ch = ws.rows.filter((r) => r.working && Object.keys(r.working).length).map((r) => `${r.id}:${JSON.stringify(r.working)}`); log('  changed', ch.join(' '))
})
import { setRole } from './lib.mjs'
save(errors); await browser.close()
