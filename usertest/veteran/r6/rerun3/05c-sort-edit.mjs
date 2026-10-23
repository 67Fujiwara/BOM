// キーボードだけで: 並び替え（Shift+S）→ Enter → 編集欄が描かれない → IME の入力が消える
import { launch, fresh, goto, toColKey, cursor, mode, sleep, dumpErrors, save, proj, cursorVisible, shot, storeState } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
for (const [tag, setup] of [
  ['sortDesc', async () => { await goto(page, 'R060'); await toColKey(page, 'model'); await page.keyboard.press('Shift+S'); await sleep(80) }],
  ['filterEsc', async () => { await goto(page, 'R070'); await toColKey(page, 'name'); await page.keyboard.press('/'); await page.keyboard.type('R07'); await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.press('/'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(80) }],
]) {
  await fresh(page)
  await page.keyboard.press('1')
  await setup()
  const cur = await cursor(page)
  const v0 = await cursorVisible(page)
  await page.keyboard.press('Enter'); await sleep(80)
  const ed = await page.getByTestId('cell-editor').count()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { selectionStart: 2, selectionEnd: 2, text: 'りれ' })
  await cdp.send('Input.insertText', { text: 'リレー' })
  await sleep(60)
  const ev = await storeState(page, (s) => ({ mode: s.mode, editValue: s.editValue }))
  await shot(page, '05c-' + tag)
  await page.keyboard.press('Enter'); await sleep(60)
  const id = cur.split(' ')[0]
  const r = (await proj(page)).rows.find((x) => x.id === id)
  out[tag] = { cursor: cur, cursorVisibleBefore: v0, editorInDom: ed, storeAfterIme: ev, saved: { name: r?.working?.name ?? r?.name, model: r?.working?.model ?? r?.model } }
  console.log(tag, JSON.stringify(out[tag]))
}
save('05c-sort-edit.json', out)
dumpErrors(errors, '05c')
await browser.close()
