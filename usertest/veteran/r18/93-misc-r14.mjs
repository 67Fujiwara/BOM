// ラウンド14: 編集中の Ctrl+D（ラウンド13 の修正: 既定動作を止める）と、ガイドの入力方法をテンキーで選ぶ・打ち始めの Ctrl+D・Ctrl+Shift+D
import { open, reset, sleep, logger, gotoCell, state, cdpKey } from './lib18.mjs'
import { NUMPAD } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`93-misc-r14-${port}${process.env.RUN ?? ''}.json`)
const cdp = await env.context.newCDPSession(pg)
await pg.evaluate(() => { window.__dp = []; window.addEventListener('keydown', (e) => { if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) setTimeout(() => window.__dp.push({ key: e.key, shift: e.shiftKey, prevented: e.defaultPrevented, target: document.activeElement?.tagName }), 0) }, true) })
const dp = () => pg.evaluate(() => window.__dp.splice(0))
async function K(name, setup, keys) {
  await reset(env); await pg.evaluate(() => { window.__dp = window.__dp ?? []; if (!window.__hooked) { window.__hooked = 1; window.addEventListener('keydown', (e) => { if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) setTimeout(() => window.__dp.push({ key: e.key, shift: e.shiftKey, prevented: e.defaultPrevented, target: document.activeElement?.tagName }), 0) }, true) } })
  await setup(); const seq = []
  for (const k of keys) { if (k.startsWith('T:')) await pg.keyboard.type(k.slice(2)); else if (k.startsWith('NP:')) { const d = k.slice(3); await cdpKey(cdp, { key: d, code: 'Numpad' + d, text: d, vk: NUMPAD[d] }) } else await pg.keyboard.press(k); await sleep(120); const s = await state(pg); seq.push(`${k}→${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '{' + s.panel + '}' : ''} «${s.toast.slice(0, 80)}»`) }
  log({ name, seq, ctrlD: await dp(), r010: await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return r.working?.name ?? r.name }) })
}
await K('D1 R010 部品名で打ち始め「AB」→ Ctrl+D → Enter', () => gotoCell(pg, 1, 'R010', '部品名'), ['T:AB', 'Control+d', 'Enter'])
await K('D2 R010 部品名で F2（編集）→ Ctrl+D → Esc', () => gotoCell(pg, 1, 'R010', '部品名'), ['F2', 'Control+d', 'Escape'])
await K('D3 ナビで Ctrl+D', () => gotoCell(pg, 1, 'R010', '部品名'), ['Control+d'])
await K('D4 打ち始め → Ctrl+Shift+D', () => gotoCell(pg, 1, 'R010', '部品名'), ['T:AB', 'Control+Shift+D', 'Escape'])
await K('D5 Ctrl+F の入力欄で Ctrl+D', () => gotoCell(pg, 1, 'R010', '部品名'), ['Control+f', 'T:リレー', 'Control+d', 'Escape'])
await K('D6 Ctrl+K のパレットで Ctrl+D', () => gotoCell(pg, 1, 'R010', '部品名'), ['Control+k', 'T:公開', 'Control+d', 'Escape'])
await K('D7 理由のダイアログの文字の欄で Ctrl+D', () => gotoCell(pg, 1, 'R004', 'ID'), ['Shift+A', '2', 'Tab', 'T:abc', 'Control+d', 'Escape', 'Escape'])
await K('W1 ガイドの入力方法をテンキー 2 で選ぶ', async () => { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('新しいBOM'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(80); await pg.getByTestId('wizard-id').fill('P-NP'); await pg.keyboard.press('Enter'); for (let i = 0; i < 6; i++) { await pg.keyboard.press('Enter'); await sleep(30) } }, ['NP:2', 'NP:3', 'NP:1'])
log({ name: 'W1 選ばれた入力方法', sel: await pg.evaluate(() => [...document.querySelectorAll('[data-testid="panel-wizard"] .opt[aria-selected="true"]')].map((e) => e.textContent.slice(0, 20))) })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
