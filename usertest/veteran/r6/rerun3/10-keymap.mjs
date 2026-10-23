// keymap.ts の全バインディング × 役割 3 × ビュー 9（ナビ）、編集モード、各パネル。ブラウザ既定動作の漏れ・フォーカス・エラー
import { launch, fresh, setRole, goto, cursor, mode, sleep, dumpErrors, shot as shot2, save as save2, panel, closeAll } from './lib.mjs'
import { parseKeymap, toPress } from '../../keymap-parse.mjs'
const KM = parseKeymap()
const KEYS = KM.flatMap((b) => b.keys.map((k) => ({ id: b.id, key: k, mode: b.mode })))
console.log('bindings', KM.length, 'keys', KEYS.length)
const { browser, page, errors } = await launch()
const out = { nav: [], edit: [], panels: [], filter: [], counts: {} }
const SENSITIVE = new Set(['Ctrl+S', 'Ctrl+P', 'Ctrl+E', 'Ctrl+G', 'Ctrl+K', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Tab', 'Shift+Tab', ' ', 'Backspace', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'Alt+ArrowLeft', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Ctrl+ArrowUp', 'Ctrl+ArrowDown', 'Ctrl+Shift+C', 'Ctrl+Shift+F', '/', 'F2', 'Ctrl+Enter', 'Ctrl+.', "'", 'Ctrl+V', 'Ctrl+C'])
async function probe() {
  await page.evaluate(() => {
    if (window.__probe) return
    window.__probe = true
    window.__keys = []
    window.addEventListener('keydown', (e) => window.__keys.push({ key: e.key, prevented: e.defaultPrevented, target: (e.target?.dataset?.testid ?? e.target?.tagName) + '' }))
  })
}
async function snap() {
  return page.evaluate(() => ({
    active: document.activeElement?.dataset?.testid ?? (document.activeElement?.className ? document.activeElement.tagName + '.' + String(document.activeElement.className).split(' ')[0] : document.activeElement?.tagName),
    panel: document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null,
    docScroll: document.scrollingElement.scrollTop + document.scrollingElement.scrollLeft,
    url: location.href,
    crash: !!document.querySelector('[data-testid="crash"]'),
    view: document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid,
    k: window.__keys.splice(0),
  }))
}
let total = 0
// ---------- ナビ: 役割 × ビュー × 全キー ----------
for (const role of process.env.SKIP_NAV ? [] : ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  await probe()
  for (const v of '123456789') {
    for (const { id, key } of KEYS) {
      await page.keyboard.press(v)
      await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown') // ラウンド6: j は文字を打てる列では値になる
      await snap()
      const n = errors.length
      try { await page.keyboard.press(toPress(key)) } catch (e) { out.nav.push({ role, v, key, err: e.message }); continue }
      total++
      await sleep(10)
      const s = await snap()
      const ev = s.k.at(-1)
      const errs = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
      const anomaly = errs.length || s.crash || s.url !== 'http://localhost:5173/' || s.docScroll > 0 || (SENSITIVE.has(key) && ev && !ev.prevented && !s.panel)
      if (anomaly) out.nav.push({ role, view: v, id, key, prevented: ev?.prevented, target: ev?.target, active: s.active, panel: s.panel, docScroll: s.docScroll, url: s.url, crash: s.crash, errs })
      if (s.crash || s.url !== 'http://localhost:5173/') { await fresh(page, role); await probe() }
      if (s.docScroll > 0) await page.evaluate(() => document.scrollingElement.scrollTo(0, 0))
      await closeAll(page)
    }
  }
  console.log('role done', role, total, 'anomalies', out.nav.length)
}
out.counts.nav = total
// ---------- 編集モード ----------
total = 0
await fresh(page)
await probe()
for (const { id, key, mode: bm } of KEYS) {
  if (['Enter', 'Tab', 'Shift+Tab', 'Escape', 'F2'].includes(key)) continue
  await goto(page, 'R020')
  await page.keyboard.press('Enter')
  if ((await mode(page)) !== '編集') { out.edit.push({ key, err: 'not in edit' }); continue }
  const v0 = await page.evaluate(() => document.querySelector('[data-testid="cell-editor"]')?.value ?? '')
  await snap()
  const n = errors.length
  await page.keyboard.press(toPress(key)); total++
  await sleep(15)
  const s = await snap()
  const ev = s.k.at(-1)
  const m = await mode(page)
  const v1 = await page.evaluate(() => document.querySelector('[data-testid="cell-editor"]')?.value ?? null)
  const errs = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
  // 1 キー操作（nav）が反応した = モードが変わった / パネルが開いた / ビューが変わった
  const reacted = bm === 'nav' && (m !== '編集' || s.panel || s.view !== 'view-1')
  const leak = SENSITIVE.has(key) && /^(Ctrl|Alt)/.test(key) && ev && !ev.prevented && !['Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+C', 'Ctrl+V', 'Ctrl+ArrowUp', 'Ctrl+ArrowDown', 'Alt+ArrowUp', 'Alt+ArrowDown'].includes(key)
  if (reacted || leak || errs.length || s.crash) out.edit.push({ id, key, bindingMode: bm, modeAfter: m, panel: s.panel, view: s.view, prevented: ev?.prevented, v0: v0.slice(0, 20), v1: v1?.slice(0, 20), errs })
  await closeAll(page)
  await page.keyboard.press('1')
}
out.counts.edit = total
// ---------- パネル内: ブラウザ既定キー ----------
const PANEL_OPEN = {
  palette: async () => page.keyboard.press('Control+k'),
  help: async () => page.keyboard.press('?'),
  columns: async () => page.keyboard.press('Alt+KeyC'),
  goto: async () => page.keyboard.press('Control+g'),
  issue_kind: async () => { await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Alt+Shift+KeyI') },
  issue_text: async () => { await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Alt+Shift+KeyI'); await page.keyboard.press('k') },
  adopt: async () => { await setRole(page, 'design'); await goto(page, 'R020'); await page.keyboard.press('Alt+Shift+KeyA') },
  wizard: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter') },
  wizard_paste: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-id').fill('P-KEY' + Math.floor(Math.random() * 1e6)); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter'); await page.keyboard.press('1') },
  inbox: async () => page.keyboard.press('Control+p'),
  settings: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter') },
  settings_edit: async () => { await setRole(page, 'pm'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter') },
  quickfix: async () => { await setRole(page, 'design'); await page.keyboard.press('4'); await page.keyboard.press('F8'); await page.keyboard.press('Control+Period') },
  history: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('履歴'); await page.keyboard.press('Enter') },
  weights: async () => { await goto(page, 'R020'); await page.keyboard.press('Alt+KeyW') },
  export: async () => page.keyboard.press('Control+e'),
  import: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter') },
  confirm: async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('サンプルデータに戻す'); await page.keyboard.press('Enter') },
  reply: async () => { await goto(page, 'R016'); await page.keyboard.press('Alt+Shift+KeyR') },
}
const PKEYS = ['Control+s', 'Control+p', 'Control+e', 'Control+g', 'Control+Shift+C', 'Control+Shift+F', 'Tab', 'Shift+Tab', 'Space', 'Backspace', 'Alt+ArrowLeft', 'PageDown', 'End', 'F2', 'Control+Enter', 'Control+z', 'Control+y', 'Control+Period', 'Control+ArrowDown', '/']
total = 0
for (const [name, open] of Object.entries(PANEL_OPEN).filter(([n]) => !process.env.ONLYP || process.env.ONLYP.split(',').includes(n))) {
  for (const k of PKEYS) {
    await fresh(page)
    await probe()
    try { await open() } catch (e) { out.panels.push({ name, k, err: 'open failed ' + e.message.slice(0, 80) }); break }
    await sleep(40)
    if (!(await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')))) await sleep(500) // ラウンド5: 英字コマンドの 0.4 秒待ち
    const p0 = await snap()
    if (!p0.panel) { out.panels.push({ name, k, err: 'panel not open' }); break }
    const n = errors.length
    await page.keyboard.press(k); total++
    await sleep(30)
    const s = await snap()
    const ev = s.k.at(-1)
    const errs = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
    // パネルが開いたままフォーカスがパネル外（BODY / gridwrap / ボタン）に抜けた
    const focusOut = s.panel && !(await page.evaluate(() => { const p = document.querySelector('[data-testid^="panel-"]'); return !!p && (p.contains(document.activeElement) || document.activeElement === document.body) }))
    const focusBody = s.panel && s.active === 'BODY' && p0.active !== 'BODY'
    const leak = /^Control\+[spegSPEG]$|^Alt\+ArrowLeft$|^Control\+Shift\+[CF]$/.test(k) && ev && !ev.prevented
    if (focusOut || focusBody || leak || errs.length || s.crash || s.url !== 'http://localhost:5173/' || s.docScroll > 0) out.panels.push({ name, k, panelBefore: p0.panel, panelAfter: s.panel, activeBefore: p0.active, activeAfter: s.active, prevented: ev?.prevented, focusOut, focusBody, docScroll: s.docScroll, errs })
  }
  console.log('panel done', name)
}
out.counts.panels = total
// ---------- 絞り込み入力中 ----------
total = 0
for (const k of ['Tab', 'Shift+Tab', 'Control+z', 'Control+s', 'Control+p', 'Control+e', 'Control+g', 'Control+k', 'Control+Enter', 'Control+Shift+C', 'Control+Shift+F', 'Alt+ArrowLeft', 'PageDown', 'Escape', '?', '1', 'j', 'Space', 'Control+Period', 'F2']) {
  await fresh(page); await probe()
  await page.keyboard.press('/')
  await page.keyboard.type('リ')
  await snap()
  const n = errors.length
  await page.keyboard.press(k); total++
  await sleep(30)
  const s = await snap()
  const ev = s.k.at(-1)
  out.filter.push({ k, prevented: ev?.prevented, activeAfter: s.active, panel: s.panel, filterVal: await page.getByTestId('filter').inputValue(), view: s.view, errs: errors.slice(n).filter((e) => e.type === 'pageerror').map((e) => e.text.slice(0, 100)) })
}
out.counts.filter = total
save2(process.env.SKIP_NAV ? '10b-keymap-edit-panels.json' : '10-keymap.json', out)
console.log('nav anomalies', out.nav.length, 'edit', out.edit.length, 'panels', out.panels.length)
dumpErrors(errors, 'keymap')
await browser.close()
