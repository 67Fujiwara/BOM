import { launch, fresh, setRole, goto, cursor, mode, toast, dumpErrors, shot, save, sleep } from './lib.mjs'
import { parseKeymap, toPress } from './keymap-parse.mjs'
const KM = parseKeymap()
console.log('bindings:', KM.length, 'keys:', KM.flatMap((b) => b.keys).length)
const { browser, page, errors } = await launch()
const results = []
async function probe() {
  await page.evaluate(() => {
    window.__keys = []
    window.addEventListener('keydown', (e) => window.__keys.push({ key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, prevented: e.defaultPrevented, target: e.target?.tagName + (e.target?.className ? '.' + String(e.target.className).split(' ')[0] : '') }))
  })
}
async function snap() {
  return page.evaluate(() => ({
    active: document.activeElement?.tagName + '.' + (document.activeElement?.className || '') + (document.activeElement?.dataset?.testid ? '#' + document.activeElement.dataset.testid : ''),
    panel: document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null,
    scroll: document.querySelector('.gridwrap')?.scrollTop ?? -1,
    url: location.href,
    keys: window.__keys.splice(0),
  }))
}
async function closeAll() {
  for (let i = 0; i < 12; i++) {
    const p = await page.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))
    const m = await mode(page)
    if (!p && m === 'ナビ') break
    await page.keyboard.press('Escape')
  }
  await page.locator('.gridwrap').focus()
}
// ---------- nav mode, per role ----------
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  await probe()
  await goto(page, 'R020')
  for (const b of KM) for (const k of b.keys) {
    const before = { cursor: await cursor(page), mode: await mode(page) }
    const errN = errors.length
    page._tag = `nav/${role}/${k}`
    try { await page.keyboard.press(toPress(k)) } catch (e) { results.push({ role, mode: 'nav', id: b.id, key: k, err: 'press failed ' + e.message }); continue }
    await sleep(30)
    const s = await snap()
    const after = { cursor: await cursor(page), mode: await mode(page), toast: await toast(page) }
    const kev = s.keys.at(-1)
    results.push({ role, mode: 'nav', id: b.id, key: k, before, after, panel: s.panel, active: s.active, prevented: kev?.prevented, target: kev?.target, url: s.url, newErrors: errors.slice(errN).map((e) => e.text) })
    if (s.url !== 'http://localhost:5173/') { console.log('URL CHANGED', k, s.url); await fresh(page, role); await probe(); await goto(page, 'R020') }
    await closeAll()
    if ((await mode(page)) !== 'ナビ') console.log('stuck mode after', k, await mode(page))
    if (!(await cursor(page)).startsWith('R')) await goto(page, 'R020')
  }
}
// ---------- edit mode: nav keys must not act, any keys must not leak ----------
await fresh(page, 'design')
await probe()
await goto(page, 'R020')
for (const b of KM) for (const k of b.keys) {
  if (['Enter', 'Tab', 'Shift+Tab', 'Escape', 'F2'].includes(k)) continue
  await page.keyboard.press('Enter') // edit 部品名
  if ((await mode(page)) !== '編集') { console.log('could not enter edit before', k); continue }
  const v0 = await page.getByTestId('cell-editor').inputValue()
  page._tag = `edit/${k}`
  const errN = errors.length
  try { await page.keyboard.press(toPress(k)) } catch (e) { results.push({ mode: 'edit', id: b.id, key: k, err: e.message }); await closeAll(); continue }
  await sleep(30)
  const s = await snap()
  const m = await mode(page)
  const ed = page.getByTestId('cell-editor')
  const v1 = (await ed.count()) ? await ed.inputValue() : null
  const kev = s.keys.at(-1)
  results.push({ mode: 'edit', id: b.id, key: k, bindingMode: b.mode, modeAfter: m, valueBefore: v0, valueAfter: v1, panel: s.panel, active: s.active, prevented: kev?.prevented, target: kev?.target, toast: await toast(page), newErrors: errors.slice(errN).map((e) => e.text) })
  await closeAll()
  await goto(page, 'R020')
}
// ---------- panel/palette mode: Ctrl+S / Ctrl+P / Ctrl+E / Ctrl+G leak? ----------
await fresh(page, 'design')
await probe()
await goto(page, 'R020')
for (const [panelKey, name] of [['Control+k', 'palette'], ['?', 'help'], ['Control+g', 'prompt'], ['c', 'columns'], ['Shift+I', 'issue'], ['Control+e', 'export']]) {
  await page.keyboard.press(panelKey)
  await sleep(50)
  for (const k of ['Ctrl+S', 'Ctrl+P', 'Ctrl+E', 'Ctrl+G', 'Ctrl+Shift+C', 'Ctrl+Shift+F', 'Ctrl+Z', 'Ctrl+K', 'Tab', 'Backspace', 'Ctrl+Enter', '1', 'j', 'a']) {
    page._tag = `panel/${name}/${k}`
    const errN = errors.length
    const panelBefore = (await snap()).panel
    await page.keyboard.press(toPress(k))
    await sleep(30)
    const s = await snap()
    const kev = s.keys.at(-1)
    results.push({ mode: 'panel:' + name, key: k, panelBefore, panelAfter: s.panel, active: s.active, prevented: kev?.prevented, target: kev?.target, toast: await toast(page), cursor: await cursor(page), newErrors: errors.slice(errN).map((e) => e.text) })
    if (s.panel !== panelBefore) { await closeAll(); await page.keyboard.press(panelKey); await sleep(50) }
  }
  await closeAll()
  await goto(page, 'R020')
}
// filter input mode
await page.keyboard.press('/')
for (const k of ['Ctrl+S', 'Ctrl+P', 'Ctrl+K', 'Ctrl+Z', 'Tab', '?', 'j', 'Space', '1', 'Ctrl+Enter', 'Backspace']) {
  page._tag = `filter/${k}`
  await page.keyboard.press(toPress(k))
  await sleep(20)
  const s = await snap()
  const kev = s.keys.at(-1)
  results.push({ mode: 'filter', key: k, active: s.active, prevented: kev?.prevented, panel: s.panel, filter: await page.getByTestId('filter').inputValue(), cursor: await cursor(page) })
  if (s.panel) await closeAll()
  if (!s.active.includes('filter')) { await page.locator('.gridwrap').focus(); await page.keyboard.press('/') }
}
await shot(page, '01-keymap-end')
save('01-keymap.json', results)
const uniq = dumpErrors(errors, 'keymap')
save('01-keymap-errors.json', errors)
await browser.close()
