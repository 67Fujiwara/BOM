// N11-01 / U11-04 再検証と、数字で始まる変更番号（Tab・クリック・そのまま打つ）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w01_dialog_digits')
const st = async (tag) => { const u = await ui(page); const txt = await page.getByTestId('prompt-text').inputValue().catch(() => '-'); const sel = await page.locator('.overlay [aria-selected="true"], .overlay .selected, .overlay .on').first().textContent().catch(() => '-'); log(`  [${tag}] panel=${u.panel} 欄=${JSON.stringify(txt)} 選択=${sel} | toast: ${(await T.toast(page))?.slice(0, 120)}`) }
const sub = async () => { const p = await proj(page); const s = p.submissions.at(-1); return JSON.stringify({ rev: s?.rev, changeSet: s?.changeSet }) }
async function pub(title, steps, shotName) {
  log('== ' + title)
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await typeReal(page, 'Lamp', 20); await page.keyboard.press('Enter'); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(150)
  for (const k of steps) {
    if (k === 'click') await page.getByTestId('prompt-text').click()
    else if (k.startsWith('t:')) await typeReal(page, k.slice(2))
    else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2))
    else await page.keyboard.press(k)
    await sleep(70); await st(k)
  }
  if (shotName) await shot(page, shotName)
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200) }
  log(`  -> ${await sub()} | toast: ${await T.toast(page)} | panel=${await T.panel(page)}`)
  if (await T.panel(page)) { log('   still open: ' + (await T.panelText(page))); await page.keyboard.press('Escape') }
}
await pub('公開: 1 → 2（選び直し）→ Enter', ['1', '2'])
await pub('公開: 1 → Tab → 2026-012 → Enter（案内どおり）', ['1', 'Tab', 't:2026-012'], 'w01_tab_changeno')
await pub('公開: 1 → そのまま 2026-012 → Enter（Tab を知らない新人）', ['1', 't:2026-012'], 'w01_no_tab_changeno')
await pub('公開: 1 → 欄をクリック → 2026-012 → Enter（マウスで欄へ）', ['1', 'click', 't:2026-012'], 'w01_click_changeno')
await pub('公開: 選ばずに Tab → 2026-012 → Enter（理由を選び忘れ）', ['Tab', 't:2026-012'])
await pub('公開: 1 → Tab → 12 → Shift+Tab → 5（理由を選び直したい）→ Enter', ['1', 'Tab', 't:12', 'Shift+Tab', '5'], 'w01_shifttab_5')
await pub('公開: 1 → ECN-12 → Enter（英字で始まる番号）', ['1', 't:ECN-12'])
await pub('公開: 4 → a → Backspace → 3 → Enter（文字を消してから数字）', ['4', 't:a', 'Backspace', '3'])
await pub('公開: 1 → 2 → Tab → 欄に何も打たず Shift+Tab → 3 → Enter', ['1', 'Tab', 'Shift+Tab', '3'])

log('== 役割: 2 → 3 → Tab → Sato → Enter')
await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(50)
await runPalette(page, '役割', '役割を切り替え'); await sleep(150)
for (const k of ['2', '3', 'Tab', 't:Sato']) { if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else await page.keyboard.press(k); await sleep(70); await st(k) }
await page.keyboard.press('Enter'); await sleep(200)
log('  user', JSON.stringify((await ui(page)).role), JSON.stringify((await ui(page)).user), await T.toast(page))

log('== 採用: R005 2位 → 理由 1 → 欄をクリック → 3日で入る（3 は打鍵、日で入るは IME） → Enter')
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await sleep(150); await page.keyboard.press('2'); await sleep(150)
for (const k of ['1', 'click', 't:3', 'i:日で入る']) { if (k === 'click') await page.getByTestId('prompt-text').click(); else if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2)); else await page.keyboard.press(k); await sleep(70); await st(k) }
await shot(page, 'w01_adopt_click_3')
await page.keyboard.press('Enter'); await sleep(200)
let r = await row(page, 'R005'); log('  R005', r.status, r.adoptedSupplierId, JSON.stringify(r.adoptReason ?? null), await T.toast(page))

log('== 採用: R005 2位 → 理由 1 → 3日で入る（Tab なし。3 は打鍵）→ Enter')
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await sleep(150); await page.keyboard.press('2'); await sleep(150)
for (const k of ['1', 't:3', 'i:日で入る']) { if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2)); else await page.keyboard.press(k); await sleep(70); await st(k) }
await page.keyboard.press('Enter'); await sleep(200)
r = await row(page, 'R005'); log('  R005', r.status, r.adoptedSupplierId, JSON.stringify(r.adoptReason ?? null), await T.toast(page))
save(errors); await browser.close()
