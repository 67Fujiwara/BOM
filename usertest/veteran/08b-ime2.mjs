import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
await fresh(page)
await goto(page, 'R020')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('公開')
await page.evaluate(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })) })
log({ case: 'palette Enter isComposing', panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid), toast: await toast(page) })
await page.keyboard.press('Escape')
// Real IME in palette via CDP: composition then Enter
const cdp = await page.context().newCDPSession(page)
await page.keyboard.press('Control+k'); await sleep(50)
await cdp.send('Input.imeSetComposition', { text: 'こうかい', selectionStart: 4, selectionEnd: 4 })
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await sleep(50)
log({ case: 'palette CDP composition + Enter', panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid), query: await page.getByTestId('palette-input').inputValue().catch(() => null), toast: await toast(page) })
await cdp.send('Input.insertText', { text: '公開' }); await sleep(50)
log({ case: 'after commit 公開', query: await page.getByTestId('palette-input').inputValue().catch(() => null), first: await page.locator('[data-testid="palette-list"] .item').first().textContent().catch(() => null) })
await page.keyboard.press('Escape')
// issue text: J as first char
await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k')
await page.keyboard.press('Shift+J')
log({ case: 'issue text Shift+J as first char', cursor: await cursor(page), text: await page.getByTestId('issue-text').inputValue().catch(() => null), header: await page.locator('.dialog h3').textContent() })
await page.keyboard.type('IS規格の確認'); await page.keyboard.press('Enter'); await sleep(50)
const ws = await state(page); const p = ws.projects[0]
log({ case: 'issue raised on which row?', toast: await toast(page), issue: p.issues.filter((i) => i.status === 'draft').map((i) => ({ rowId: i.rowId, text: i.text })) })
await page.keyboard.press('Control+z')
// issue text with 'k' typed as first char in kind step? (kind step keys are consumed) and unknown key
await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('z'); log({ case: 'issue kind unknown key z', step: await page.getByTestId('issue-kinds').count() }); await page.keyboard.press('n'); log({ case: 'issue kind n (納期NG blocked)', step: await page.getByTestId('issue-kinds').count(), toast: await toast(page) }); await page.keyboard.press('Escape')
// Tab in issue text → proposal; Tab again in proposal → ?
await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('a'); await page.keyboard.type('代替'); await page.keyboard.press('Tab'); log({ case: 'Tab to proposal', active: await page.evaluate(() => document.activeElement?.dataset?.testid) })
await page.keyboard.type('ALT-1'); await page.keyboard.press('Tab'); log({ case: 'Tab in proposal 1', active: await page.evaluate(() => document.activeElement?.dataset?.testid) }); await page.keyboard.type('メーカX'); await page.keyboard.press('Tab'); await page.keyboard.type('S2'); await page.keyboard.press('Tab'); await page.keyboard.type('1,200'); await page.keyboard.press('Tab'); await page.keyboard.type('abc'); await page.keyboard.press('Enter'); await sleep(50)
const p2 = (await state(page)).projects[0]
log({ case: 'proposal issue', toast: await toast(page), issue: p2.issues.filter((i) => i.status === 'draft').map((i) => ({ rowId: i.rowId, text: i.text, proposal: i.proposal })) })
// unbound letters in nav
await setRole(page, 'design'); await goto(page, 'R020'); await toCol(page, '部品名')
const res = {}
for (const ch of 'bdeglmpqtuvz') { await page.keyboard.press(ch); res[ch] = (await mode(page)) + ':' + (await page.getByTestId('cell-editor').inputValue().catch(() => null)); await page.keyboard.press('Escape') }
for (const ch of ['Shift+B', 'Shift+C', 'Shift+E', 'Shift+T', 'Shift+Z']) { await page.keyboard.press(ch); res[ch] = (await mode(page)) + ':' + (await page.getByTestId('cell-editor').inputValue().catch(() => null)); await page.keyboard.press('Escape') }
log({ case: 'unbound letters start edit (overwrite)', res })
await goto(page, 'R020'); await toCol(page, '必要数'); await page.keyboard.press('5'); log({ case: 'digit 5 on qty col (nav)', mode: await mode(page), view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await page.keyboard.press('1'); await goto(page, 'R020'); await toCol(page, '必要数'); await page.keyboard.press('0'); log({ case: 'digit 0 on qty col (nav)', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await page.keyboard.press('-'); log({ case: '- on qty col', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await page.keyboard.press('.'); log({ case: '. on qty col', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null) }); await page.keyboard.press('Escape')
await toCol(page, 'ID'); await page.keyboard.press('z'); log({ case: 'type on ID col', mode: await mode(page), toast: await toast(page) })
await toCol(page, '状態'); await page.keyboard.press('z'); log({ case: 'type on status col', mode: await mode(page), toast: await toast(page) })
await setRole(page, 'purchasing'); await goto(page, 'R020'); await toCol(page, '部品名'); await page.keyboard.press('z'); log({ case: 'purchasing type on name col', mode: await mode(page), toast: await toast(page) })
save('08b-ime2.json', out)
dumpErrors(errors, 'ime2')
await browser.close()
