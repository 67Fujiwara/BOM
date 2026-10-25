// ラウンド14: 最後の行の Enter の知らせ（U13-03 の修正）。表の最後・4 要確認（絞った表）の最後・検索で絞った最後・購買で
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q06_lastrow')
const st = async (tag) => { const u = await ui(page); const p = await proj(page); log(`  [${tag}] view=${u.view} mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} rows=${p.rows.length} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
log('== A 設計 Ctrl+End → Enter ×3 → 打って Enter → Shift+Enter')
await fresh(page); await page.keyboard.press('Control+End'); await sleep(100); await st('Ctrl+End')
for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await sleep(120); await st('Enter' + (i + 1)) }
await page.keyboard.press('Escape'); await sleep(80)
await typeReal(page, 'abc'); await page.keyboard.press('Enter'); await sleep(120); await st('abc Enter')
await page.keyboard.press('Shift+Enter'); await sleep(150); await st('Shift+Enter')
await typeReal(page, 'Relay'); await page.keyboard.press('Enter'); await sleep(150); await st('Relay Enter')
log('  last rows: ' + (await proj(page)).rows.slice(-3).map((r) => `${r.id}:${r.name}/${r.category}`).join(' '))

log('== B 4 要確認の最後の行 → 打って Enter → 知らせのとおり Shift+Enter')
await fresh(page); await page.keyboard.press('Alt+4'); await sleep(150); await page.keyboard.press('Control+End'); await sleep(100); await st('4 Ctrl+End')
await page.keyboard.press('Enter'); await sleep(100); await st('Enter (edit)')
await page.keyboard.press('Enter'); await sleep(150); await st('Enter (commit)')
await page.keyboard.press('Shift+Enter'); await sleep(150); await st('Shift+Enter')
const p = await proj(page); const cr = (await ui(page)).cursorRow; log('  new row: ' + JSON.stringify(p.rows.find((r) => r.id === cr) ?? null).slice(0, 200))
await shot(page, 'q06_B_view4_shift_enter')

log('== C 購買で最後の行 Enter')
await fresh(page, 'purchasing'); await page.keyboard.press('Control+End'); await sleep(100); await st('Ctrl+End')
await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(120); await st('Enter Enter')

log('== D 設計で表の真ん中で Enter（知らせが出ないこと）')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(120); await st('R030 Enter Enter')
save(errors); await browser.close()
