// ラウンド15: N14-06 の直し（数字だけの氏名は止める・クリックで文字の欄に移ったら知らせる）を新人の操作で。止められたあと知らせのとおりに Shift+Tab → 3 → Enter
import { launch, fresh, T, makeLog, ui, typeReal, sleep, shot, proj, sel, gotoCol } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r04_name15')
const st = async (tag) => { const u = await ui(page); const pt = page.getByTestId('prompt-text'); const txt = (await pt.count()) ? await pt.inputValue() : '-'; const so = page.locator('.overlay [aria-selected="true"]'); const selx = (await so.count()) ? await so.first().textContent() : '-'; log(`  [${tag}] role=${u.role} user=${JSON.stringify(u.user)} panel=${u.panel} 欄=${JSON.stringify(txt)} 選択=${selx} mode=${u.mode} view=${u.view} | toast: ${(await T.toast(page))?.slice(0, 160)}`) }
async function act(k) {
  if (k.startsWith('w:')) { await sleep(Number(k.slice(2))); return }
  if (k.startsWith('opt:')) await page.getByTestId('prompt-options').locator('.opt').nth(Number(k.slice(4)) - 1).click()
  else if (k.startsWith('t:')) await typeReal(page, k.slice(2))
  else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2))
  else await page.keyboard.press(k)
  await sleep(120)
}
async function role(title, steps) {
  log('== ' + title)
  await fresh(page); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150)
  await st('open')
  for (const k of steps) { await act(k); await st(k) }
  await shot(page, 'r04_' + title.split(' ')[0])
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
}
await role('a PM をクリック → 3 → Enter → 知らせのとおり Shift+Tab → 3 → Enter', ['opt:3', '3', 'Enter', 'w:1500'])
await role('a2 PM をクリック → 3 → Enter（止められたら開き直して Shift+Tab → 3 → Enter）', ['opt:3', '3', 'Enter', 'w:300'])
if (!(await T.panel(page))) { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150); await st('reopen') }
for (const k of ['Shift+Tab', '3', 'Enter']) { await act(k); await st(k) }
await role('b 購買をクリック → ２（全角）→ Enter', ['opt:2', 'i:２', 'Enter'])
await role('c 購買をクリック → 2. → Enter', ['opt:2', 't:2.', 'Enter'])
await role('d 購買をクリック → 2番 → Enter', ['opt:2', 'i:2番', 'Enter'])
await role('e PM をクリック → PM（役割の名前を氏名に）→ Enter', ['opt:3', 't:PM', 'Enter'])
await role('f Tab → 3 → Enter（文字の欄で数字。PM のつもり）', ['Tab', '3', 'Enter'])
await role('g 選択肢をクリックせずに 3 → 3（PM のつもりで 2 回）→ Enter', ['3', '3', 'Enter'])
// 公開の理由: クリック → 3（廃番のつもり）。知らせは出るか、番号「3」は止まるか
log('== h 公開: 理由 1 をクリック → 3 → Enter')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await typeReal(page, 'Lamp', 20); await page.keyboard.press('Enter'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(150); await st('open')
for (const k of ['opt:1', '3']) { await act(k); await st(k) }
await page.keyboard.press('Enter'); await sleep(250)
const p = await proj(page); const s = p.submissions.at(-1); log(`  -> ${JSON.stringify({ rev: s?.rev, changeSet: s?.changeSet })} | toast: ${await T.toast(page)}`)
save(errors); await browser.close()
