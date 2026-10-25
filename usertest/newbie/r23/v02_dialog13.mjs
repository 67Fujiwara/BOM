// ラウンド13: ダイアログの選択肢／文字の欄の状態（マウスで選択肢をクリック、欄を先にクリック、Tab 2 回、Esc、フッター）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v02_dialog13')
const foot = async () => (await page.locator('.overlay .foot, .overlay footer, .overlay .dialog > :last-child').last().innerText().catch(() => '-')).replace(/\s+/g, ' ')
const st = async (tag) => { const u = await ui(page); const txt = await page.getByTestId('prompt-text').inputValue().catch(() => '-'); const sel = await page.locator('.overlay [aria-selected="true"]').first().textContent().catch(() => '-'); const focus = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.dataset?.testid ? '#' + a.dataset.testid : ''}${a.className ? '.' + String(a.className).split(' ')[0] : ''}` : '-' }); log(`  [${tag}] panel=${u.panel} 欄=${JSON.stringify(txt)} 選択=${sel} focus=${focus} foot=「${await foot()}」 | toast: ${(await T.toast(page))?.slice(0, 110)}`) }
const sub = async () => { const p = await proj(page); const s = p.submissions.at(-1); return JSON.stringify({ rev: s?.rev, changeSet: s?.changeSet }) }
async function act(k) {
  if (k === 'click') await page.getByTestId('prompt-text').click()
  else if (k.startsWith('opt:')) await page.getByTestId('prompt-options').locator('.opt').nth(Number(k.slice(4)) - 1).click()
  else if (k.startsWith('t:')) await typeReal(page, k.slice(2))
  else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2))
  else await page.keyboard.press(k)
  await sleep(80)
}
async function pub(title, steps, shotName) {
  log('== ' + title)
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await typeReal(page, 'Lamp', 20); await page.keyboard.press('Enter'); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(150)
  await st('open')
  for (const k of steps) { await act(k); await st(k); if (shotName && k === steps.at(-1)) await shot(page, shotName) }
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200) }
  log(`  -> ${await sub()} | toast: ${await T.toast(page)} | panel=${await T.panel(page)}`)
  if (await T.panel(page)) { log('   still open: ' + (await T.panelText(page))); await page.keyboard.press('Escape'); await sleep(80); await page.keyboard.press('Escape') }
}
await pub('a 1 → 欄をクリック → ab → 選択肢 4 をマウスでクリック → 5 を押す（数字で選び直すつもり）→ Enter', ['1', 'click', 't:ab', 'opt:4', '5'], 'v02_a_click_option_then_digit')
await pub('b 何も選ばずに欄をクリック → 2026-012 → Shift+Tab → 1 → Enter', ['click', 't:2026-012', 'Shift+Tab', '1'], 'v02_b')
await pub('c 1 → Tab → 2026-012 → Shift+Tab → ↓ → Enter', ['1', 'Tab', 't:2026-012', 'Shift+Tab', 'ArrowDown'])
await pub('d 1 → Tab → Tab → 12 → Enter（Tab を 2 回）', ['1', 'Tab', 'Tab', 't:12'])
await pub('e 選択肢 3 をマウスでクリック → 2026-012 を打つ（Tab なし）→ Enter', ['opt:3', 't:2026-012'], 'v02_e_mouse_then_type')
await pub('f 1 → Tab → ECN → Esc（やめる）', ['1', 'Tab', 't:ECN', 'Escape'])
await pub('g 何も選ばずに Enter → 1 → Enter', ['Enter', '1'])
await pub('h 1 → Tab → 2026-012 → Shift+Tab → Backspace（番号を消すつもり）→ Enter', ['1', 'Tab', 't:2026-012', 'Shift+Tab', 'Backspace', 'Backspace'])
await pub('i 1 → Tab → 12 → 欄の外（選択肢の見出し）をクリック → 3 → Enter', ['1', 'Tab', 't:12', 'opt:1', '3'])

log('== j 採用: R005 2位 → 2 → 欄をクリック → 3日で入る → Shift+Tab → 1 → Enter')
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await sleep(150); await page.keyboard.press('2'); await sleep(150)
await st('open')
for (const k of ['2', 'click', 't:3', 'i:日で入る', 'Shift+Tab', '1']) { await act(k); await st(k) }
await shot(page, 'v02_j_adopt')
await page.keyboard.press('Enter'); await sleep(200)
let r = await row(page, 'R005'); log('  R005', r.status, r.adoptedSupplierId, JSON.stringify(r.adoptReason ?? null), await T.toast(page))
save(errors); await browser.close()
