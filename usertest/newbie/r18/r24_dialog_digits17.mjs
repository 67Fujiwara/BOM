// ラウンド17: U15-01 の直し（選択肢つきのダイアログで数字だけの文字を断ったら欄を空にする）が、ほかのダイアログの数字の入力にも効くか。
// 購買の新人が「概算見積を依頼」の回答期限に Excel の癖で数字だけ（1020・20261020）を打つ → 過去の日付で止められる → 欄は残るか → 直して Enter
import { launch, fresh, T, makeLog, ui, typeReal, sleep, shot, proj, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r24_dialog_digits17')
const st = async (tag) => { const u = await ui(page); const pt = page.getByTestId('prompt-text'); const txt = (await pt.count()) ? await pt.inputValue() : '-'; const so = page.locator('.overlay [aria-selected="true"]'); const selx = (await so.count()) ? (await so.first().textContent()).slice(0, 30) : '-'; log(`  [${tag}] panel=${u.panel} 欄=${JSON.stringify(txt)} 選択=${selx} mode=${u.mode} | toast: ${(await T.toast(page))?.slice(0, 160)}`) }
async function act(k) {
  if (k.startsWith('w:')) { await sleep(Number(k.slice(2))); return }
  if (k.startsWith('opt:')) await page.getByTestId('prompt-options').locator('.opt').nth(Number(k.slice(4)) - 1).click()
  else if (k === 'click-text') await page.getByTestId('prompt-text').click()
  else if (k === 'bs4') { for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace') }
  else if (k.startsWith('t:')) await typeReal(page, k.slice(2))
  else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2))
  else await page.keyboard.press(k)
  await sleep(150)
}
async function req(title, steps) {
  log('== ' + title)
  await fresh(page, 'purchasing'); await sleep(150)
  const q0 = (await proj(page)).quotes.length
  await runPalette(page, '概算見積を依頼'); await sleep(200)
  await st('open')
  for (const k of steps) { await act(k); await st(k) }
  const p = await proj(page)
  log(`  -> quotes ${q0} -> ${p.quotes.length}, quoteDeadline=${p.settings.quoteDeadline}`)
  await shot(page, 'r24_' + title.split(' ')[0])
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
}
await req('A 回答期限に 1020（過去）→ Enter → 止められたら 1120 → Enter', ['t:1020', 'Enter', 'w:300', 't:1120', 'Enter', 'w:300'])
await req('B 回答期限に 20261020 → Enter → 止められたら 末尾だけ直すつもりで BackSpace 2 回 → 30 → Enter', ['t:20261020', 'Enter', 'w:300', 'Backspace', 'Backspace', 't:30', 'Enter', 'w:300'])
await req('C 回答期限に 10/20（スラッシュつき）→ Enter（比較: 欄は残るか）', ['t:10/20', 'Enter', 'w:300'])
await req('D 依頼先をクリック（2 番目）→ 欄をクリック → 1020 → Enter', ['opt:2', 'click-text', 't:1020', 'Enter', 'w:300'])
save(errors); await browser.close()
