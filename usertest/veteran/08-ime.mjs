import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
await fresh(page)
await goto(page, 'R020')
// 1. in edit mode, Enter with isComposing=true must NOT commit
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('abc')
await page.evaluate(() => { const el = document.activeElement; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })) })
log({ case: 'Enter isComposing in edit', mode: await mode(page), cursor: await cursor(page) })
await page.evaluate(() => { const el = document.activeElement; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true, cancelable: true })) })
log({ case: 'Process in edit', mode: await mode(page), cursor: await cursor(page) })
// Escape while composing: should cancel composition not edit
await page.evaluate(() => { const el = document.activeElement; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true })) })
log({ case: 'Escape isComposing in edit', mode: await mode(page) })
await page.keyboard.press('Escape')
// 2. nav mode: Process key starts edit? then composition text goes where? Use CDP IME
const cdp = await page.context().newCDPSession(page)
await goto(page, 'R020'); await toCol(page, '部品名')
await page.locator('.gridwrap').focus()
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Process', code: 'KeyR', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
await sleep(50)
log({ case: 'nav Process keydown via CDP', mode: await mode(page), active: await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className), editorValue: await page.getByTestId('cell-editor').inputValue().catch(() => null) })
await cdp.send('Input.imeSetComposition', { text: 'り', selectionStart: 1, selectionEnd: 1 }).catch((e) => log({ case: 'imeSetComposition err', e: e.message }))
await sleep(30)
log({ case: 'after composition り', editorValue: await page.getByTestId('cell-editor').inputValue().catch(() => null) })
await cdp.send('Input.imeSetComposition', { text: 'りれ', selectionStart: 2, selectionEnd: 2 }).catch(() => {})
await cdp.send('Input.insertText', { text: 'リレー' })
await sleep(30)
log({ case: 'after insertText リレー', editorValue: await page.getByTestId('cell-editor').inputValue().catch(() => null), mode: await mode(page), storeEditValue: await page.evaluate(() => document.querySelector('[data-testid="cell-editor"]')?.value) })
// Enter from IME confirm is typically keydown Enter with isComposing=true then keyup; simulate via CDP: keyDown Enter during composition
await cdp.send('Input.imeSetComposition', { text: 'かくてい', selectionStart: 4, selectionEnd: 4 }).catch(() => {})
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await sleep(50)
log({ case: 'Enter during CDP composition', mode: await mode(page), cursor: await cursor(page), editorValue: await page.getByTestId('cell-editor').inputValue().catch(() => null) })
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
// 3. In palette input: Enter with isComposing must not run command
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('公開')
await page.evaluate(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })) })
log({ case: 'palette Enter isComposing', panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid), toast: await toast(page) })
await page.keyboard.press('Escape')
// 4. issue text: Shift+I → k → compose + 'J' key during composition
await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k')
await page.evaluate(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', isComposing: true, bubbles: true, cancelable: true })) })
log({ case: 'issue text J isComposing', cursor: await cursor(page), step: await page.locator('.dialog .muted').first().textContent() })
// J with empty text (not composing) moves row — but a user typing capital J as first letter of text?
await page.keyboard.press('Shift+J')
log({ case: 'issue text Shift+J (empty text)', cursor: await cursor(page), text: await page.getByTestId('issue-text').inputValue().catch(() => null) })
await page.keyboard.press('Escape')
// 5. nav: typing lowercase letters that are NOT bound e.g. 'b','d','e','g','l','m','p','q','t','u','v','z' → start edit overwrite (design)
await setRole(page, 'design'); await goto(page, 'R020'); await toCol(page, '部品名')
const res = {}
for (const ch of 'bdeglmpqtuvz') { await page.keyboard.press(ch); res[ch] = { mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }; await page.keyboard.press('Escape') }
log({ case: 'unbound letters start edit', res })
// uppercase unbound: B, C, E...
for (const ch of ['Shift+B', 'Shift+C', 'Shift+E', 'Shift+T']) { await page.keyboard.press(ch); res[ch] = { mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }; await page.keyboard.press('Escape') }
log({ case: 'unbound uppercase', res2: Object.fromEntries(Object.entries(res).filter(([k]) => k.startsWith('Shift'))) })
// digits start edit on numeric col? '0' isn't bound → on qty col types 0; on name col '1'..'9' switch views!
await goto(page, 'R020'); await toCol(page, '必要数'); await page.keyboard.press('5'); log({ case: 'digit 5 on qty col (nav)', mode: await mode(page), view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await page.keyboard.press('1'); await goto(page, 'R020'); await toCol(page, '必要数'); await page.keyboard.press('0'); log({ case: 'digit 0 on qty col (nav)', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await page.keyboard.press('-'); log({ case: '- on qty col', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
// typing on computed col (ID) → nothing; on purchasing col as design → nothing (silent?)
await toCol(page, 'ID'); await page.keyboard.press('z'); log({ case: 'type on ID col', mode: await mode(page), toast: await toast(page) })
await toCol(page, '状態'); await page.keyboard.press('z'); log({ case: 'type on status col', mode: await mode(page), toast: await toast(page) })
save('08-ime.json', out)
dumpErrors(errors, 'ime')
await browser.close()
