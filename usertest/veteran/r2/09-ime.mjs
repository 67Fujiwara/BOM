// IME（isComposing / keyCode 229 / key=Process）で誤作動しないか
import { ws, launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save2, proj, row, panel, closeAll, palette, toastNow } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const cdp = await context.newCDPSession(page)
// IME の確定 Enter 等を target に送る（Chrome の実際の並び: keydown(isComposing, 229) → compositionend → keyup）
async function imeKey(key, code, target = null, variant = 'composing') {
  await page.evaluate(({ key, code, variant }) => {
    const t = document.activeElement ?? document.body
    const init = { key: variant === 'process' ? 'Process' : key, code, bubbles: true, cancelable: true, isComposing: variant === 'composing', keyCode: variant === 'composing' || variant === 'process' || variant === '229' ? 229 : 0, which: 229 }
    t.dispatchEvent(new KeyboardEvent('keydown', init))
  }, { key, code, variant })
  await sleep(30)
}
async function state() { return { mode: await mode(page), panel: await panel(page), cursor: await cursor(page), view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid) } }
await fresh(page)
// 1) ナビで 1 キー操作が IME 由来なら反応しない
for (const variant of ['composing', '229', 'process']) {
  await goto(page, 'R020'); await toCol(page, '部品名')
  const b = await state()
  const res = {}
  for (const [k, c] of [['j', 'KeyJ'], ['4', 'Digit4'], ['a', 'KeyA'], ['Enter', 'Enter'], [' ', 'Space'], ['Escape', 'Escape'], ['r', 'KeyR'], ['Delete', 'Delete']]) { await imeKey(k, c, null, variant); res[k] = await state() }
  const changed = Object.entries(res).filter(([, s]) => JSON.stringify(s) !== JSON.stringify(b)).map(([k, s]) => k + '→' + JSON.stringify(s))
  log({ case: 'nav ' + variant, changed, r020: (await row(page, 'R020')).status })
}
// 2) 編集中: 実際に IME で組成 → 確定 Enter(229) → 確定されない → 本当の Enter で確定
await goto(page, 'R020'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a')
await cdp.send('Input.imeSetComposition', { text: 'りれー', selectionStart: 3, selectionEnd: 3 })
await imeKey('Enter', 'Enter', null, 'composing')
const m1 = await mode(page)
await cdp.send('Input.insertText', { text: 'リレー' })
const v1 = await page.getByTestId('cell-editor').inputValue().catch(() => null)
await page.keyboard.press('Enter'); await sleep(30)
log({ case: 'edit: IME confirm Enter does not commit', modeAfterImeEnter: m1, editorValue: v1, saved: (await row(page, 'R020')).working?.name ?? (await row(page, 'R020')).name, cursorAfter: await cursor(page) })
// Tab / Escape / 数字 during composition
await goto(page, 'R020'); await toCol(page, '部品名'); await page.keyboard.press('Enter')
await cdp.send('Input.imeSetComposition', { text: 'て', selectionStart: 1, selectionEnd: 1 })
for (const [k, c] of [['Tab', 'Tab'], ['Escape', 'Escape'], ['ArrowDown', 'ArrowDown'], ['1', 'Digit1']]) await imeKey(k, c, null, 'composing')
log({ case: 'edit: Tab/Esc/↓/1 while composing', ...(await state()) })
await cdp.send('Input.insertText', { text: '' }); await closeAll(page)
// 3) パネル: パレット、ジャンプ、指摘本文、設定、ガイド、返信、取込
const panels = {
  palette: async () => { await page.keyboard.press('Control+k') },
  goto: async () => { await page.keyboard.press('Control+g') },
  wizard: async () => { await palette(page, '新しいBOM') },
  issueText: async () => { await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k') },
  settings: async () => { await setRole(page, 'pm'); await palette(page, '案件設定'); await page.keyboard.press('Enter') },
  filter: async () => { await page.keyboard.press('/') },
  reply: async () => { await setRole(page, 'design'); await goto(page, 'R016'); await page.keyboard.press('Shift+R') },
  decisionReason: async () => { await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y') },
}
for (const [name, open] of Object.entries(panels)) {
  await fresh(page)
  const p0 = await proj(page)
  await open(); await sleep(40)
  const b = await state()
  await cdp.send('Input.imeSetComposition', { text: 'かくにん', selectionStart: 4, selectionEnd: 4 })
  await imeKey('Enter', 'Enter', null, 'composing')
  const a1 = await state()
  await imeKey('Escape', 'Escape', null, 'composing')
  const a2 = await state()
  await cdp.send('Input.insertText', { text: '確認' })
  const val = await page.evaluate(() => document.activeElement?.value ?? null)
  const w1 = await ws(page); const p1 = w1.projects.find((x) => x.id === w1.currentProjectId)
  log({ case: 'panel ' + name, before: b, afterImeEnter: a1, afterImeEsc: a2, inputValue: val, issuesChanged: p0.issues.length !== p1.issues.length, decisionsChanged: p0.decisions.length !== p1.decisions.length, filter: await page.getByTestId('filter').inputValue() })
}
// 4) 全角英数のまま 1 キー操作（IME オン・半角変換なし）: e.key が全角
await fresh(page)
await goto(page, 'R020')
const fw = {}
for (const [k, c] of [['ｊ', 'KeyJ'], ['４', 'Digit4'], ['？', 'Slash'], ['／', 'Slash'], ['ａ', 'KeyA']]) {
  const b = await state()
  await page.evaluate(({ k, c }) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, bubbles: true, cancelable: true, shiftKey: k === '？' })), { k, c })
  await sleep(30)
  fw[k] = { before: b.cursor + '/' + b.view, after: JSON.stringify(await state()), toast: (await toastNow(page)).slice(0, 60) }
  await closeAll(page)
}
log({ case: 'full-width keys in nav', fw })
save2('09-ime.json', out)
dumpErrors(errors, 'ime')
await browser.close()
