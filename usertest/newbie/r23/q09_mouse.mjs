// ラウンド14: マウス中心の新人: セルをダブルクリックして打つ → 別の場所をクリック（役割のボタン・ビューのタブ・列の見出し・ステータスバー・詳細の欄）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q09_mouse')
const st = async (tag) => { const u = await ui(page); const r = await row(page, 'R030'); log(`  [${tag}] role=${u.role} view=${u.view} mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} sort=${JSON.stringify(u.sort)} R030 name=${r?.name} working=${JSON.stringify(r?.working ?? null)} | toast: ${await T.toast(page)}`) }
const cell = (id, col) => page.locator(`[data-row-id="${id}"] td[data-col="${col}"]`).first()
async function editThen(title, after) {
  log('== ' + title)
  await fresh(page); await sel(page, 'R030'); await sleep(150); await cell('R030', 'name').dblclick(); await sleep(100)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText('表示灯 緑'); await sleep(80); await st('typed')
  await after(); await sleep(200); await st('after')
}
await editThen('A ダブルクリックで打つ → 役割「購買」をクリック', () => page.getByTestId('role-purchasing').click())
await editThen('B ダブルクリックで打つ → ビュー 4 のタブをクリック', () => page.getByTestId('view-4').click())
await editThen('C ダブルクリックで打つ → 列の見出し（型式）をクリック', () => page.locator('thead th').filter({ hasText: '型式' }).first().click())
await editThen('D ダブルクリックで打つ → ステータスバーをクリック', () => page.getByTestId('status').click())
await editThen('E ダブルクリックで打つ → 画面の外（ヘッダー）をクリック', () => page.getByTestId('header').click({ position: { x: 5, y: 5 } }))
await editThen('F ダブルクリックで打つ → 別の行のセルをクリック', () => cell('R031', 'model').click())
await editThen('G ダブルクリックで打つ → ブラウザのタブを切り替えた（blur）', async () => { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.locator('.gridwrap').click({ position: { x: 3, y: 3 } }).catch(() => {}) })
await editThen('H ダブルクリックで打つ → Ctrl+K を押してパレットから「公開」', async () => { await page.keyboard.press('Control+k'); await sleep(100); await st('palette open'); await page.keyboard.press('Escape') })
log('== I 列の見出しをクリック（並べ替えのつもり）→ もう一度クリック')
await fresh(page)
await page.locator('thead th').filter({ hasText: '型式' }).first().click(); await sleep(150); await st('header click 1')
await page.locator('thead th').filter({ hasText: '型式' }).first().click(); await sleep(150); await st('header click 2')
await shot(page, 'q09_header_click')
save(errors); await browser.close()
