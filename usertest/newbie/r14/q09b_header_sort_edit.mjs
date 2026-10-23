// ラウンド14: 編集中に列の見出しをクリック（並べ替え）→ そのあと Enter / ↓ / 別のセルをクリック。打った値はどこに入るか
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q09b_header_sort_edit')
const changed = async () => { const p = await proj(page); return p.rows.filter((r) => r.working && Object.keys(r.working).length).map((r) => `${r.id}:${JSON.stringify(r.working)}`).join(' ') || '(なし)' }
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} sort=${JSON.stringify(u.sort)} edit=${JSON.stringify(u.editValue)} editor=${await page.getByTestId('cell-editor').count()} focus=${await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className)} 作業中=${await changed()} | toast: ${await T.toast(page)}`) }
const cell = (id, col) => page.locator(`[data-row-id="${id}"] td[data-col="${col}"]`).first()
async function run(title, after) {
  log('== ' + title)
  await fresh(page); await sel(page, 'R030'); await sleep(150); await cell('R030', 'name').dblclick(); await sleep(100)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText('表示灯 緑'); await sleep(80); await st('typed')
  await page.locator('thead th').filter({ hasText: '型式' }).first().click(); await sleep(200); await st('header click')
  await shot(page, 'q09b_' + title.split(' ')[0])
  await after(); await sleep(200); await st('after')
}
await run('A → Enter', () => page.keyboard.press('Enter'))
await run('B → ↓', () => page.keyboard.press('ArrowDown'))
await run('C → 続けて打つ「LED」→ Enter', async () => { await page.keyboard.insertText('LED'); await page.keyboard.press('Enter') })
await run('D → 見えているセルをクリック', async () => { const id = await page.getByTestId('row').first().getAttribute('data-row-id'); log('   first row ' + id); await page.getByTestId('row').nth(2).locator('td[data-col="model"]').click() })
await run('E → Esc', () => page.keyboard.press('Escape'))
log('== F 編集中にもう一度同じ列の見出し（部品名）をクリック')
await fresh(page); await sel(page, 'R030'); await sleep(150); await cell('R030', 'name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('表示灯 緑')
await page.locator('thead th').filter({ hasText: '部品名' }).first().click(); await sleep(200); await st('header 部品名')
await page.keyboard.press('Enter'); await sleep(200); await st('Enter')
save(errors); await browser.close()
