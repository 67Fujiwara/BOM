// ラウンド14: N13-07 の修正（選択肢をクリックしたら文字の欄へ）を新人の操作で: クリック → 番号、クリック → 数字で選び直すつもり、クリック 2 回、Tab の知らせ、役割の切り替え・採用の理由でも
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q03_dialog14')
const foot = async () => (await page.locator('.overlay .foot, .overlay footer, .overlay .dialog > :last-child').last().innerText().catch(() => '-')).replace(/\s+/g, ' ')
const st = async (tag) => { const u = await ui(page); const txt = await page.getByTestId('prompt-text').inputValue().catch(() => '-'); const sel = await page.locator('.overlay [aria-selected="true"]').first().textContent().catch(() => '-'); const focus = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.dataset?.testid ? '#' + a.dataset.testid : ''}${a.className ? '.' + String(a.className).split(' ')[0] : ''}` : '-' }); log(`  [${tag}] panel=${u.panel} 欄=${JSON.stringify(txt)} 選択=${sel} focus=${focus} foot=「${await foot()}」 | toast: ${(await T.toast(page))?.slice(0, 110)}`) }
const sub = async () => { const p = await proj(page); const s = p.submissions.at(-1); return JSON.stringify({ rev: s?.rev, changeSet: s?.changeSet }) }
async function act(k) {
  if (k === 'click') await page.getByTestId('prompt-text').click()
  else if (k.startsWith('dbl:')) await page.getByTestId('prompt-options').locator('.opt').nth(Number(k.slice(4)) - 1).dblclick()
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
await pub('a 選択肢 3 をクリック → 2026-012（Tab なし）→ Enter', ['opt:3', 't:2026-012'], 'q03_a')
await pub('b 選択肢 1 をクリック → 3 を押す（数字で選び直すつもり）→ Enter', ['opt:1', '3'], 'q03_b')
await pub('c 選択肢 1 をクリック → 選択肢 4 をクリック（選び直し）→ ECN-1 → Enter', ['opt:1', 'opt:4', 't:ECN-1'])
await pub('d 選択肢 2 をクリック → Shift+Tab → 5 → Enter', ['opt:2', 'Shift+Tab', '5'])
await pub('e 選択肢 2 をクリック → ↓（選び直すつもり）→ Enter', ['opt:2', 'ArrowDown'])
await pub('f 1 → Tab → 12 → 選択肢 3 をクリック → Enter（番号は残る?）', ['1', 'Tab', 't:12', 'opt:3'])
await pub('g 選択肢 3 をダブルクリック', ['dbl:3'])
await pub('h 選択肢 2 をクリック → Backspace（選択を外すつもり）→ Enter', ['opt:2', 'Backspace'])

log('== i 採用: R005 → Alt+Shift+A → 2位 → 選択肢 2 をクリック → 3日で入る → Enter')
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await sleep(150); await page.keyboard.press('2'); await sleep(150)
await st('open')
for (const k of ['opt:2', 't:3', 'i:日で入る']) { await act(k); await st(k) }
await page.keyboard.press('Enter'); await sleep(200)
let r = await row(page, 'R005'); log('  R005', r.status, r.adoptedSupplierId, JSON.stringify(r.adoptReason ?? null), await T.toast(page))

log('== j 役割の切り替え: Ctrl+K 役割 → 購買をクリック → 氏名 佐藤 → Enter')
await fresh(page); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await sleep(80)
log('  palette: ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 200))
await page.keyboard.press('Enter'); await sleep(150); await st('open')
for (const k of ['opt:2', 'i:佐藤']) { await act(k); await st(k) }
await page.keyboard.press('Enter'); await sleep(200); const u = await ui(page); log(`  -> role=${u.role} user=${u.user} toast=${await T.toast(page)}`)

log('== k 役割の切り替え: PM をクリック → 3（PM のつもりで数字）→ Enter')
await fresh(page); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150)
for (const k of ['opt:3', '3']) { await act(k); await st(k) }
await page.keyboard.press('Enter'); await sleep(200); const u2 = await ui(page); log(`  -> role=${u2.role} user=${JSON.stringify(u2.user)} toast=${await T.toast(page)}`)
save(errors); await browser.close()
