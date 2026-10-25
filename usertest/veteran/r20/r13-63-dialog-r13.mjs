// ラウンド13: ダイアログの「選択肢／文字の欄」の状態（Tab・Shift+Tab・クリック・文字）の境目
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state, cdpKey } from './lib20.mjs'
import { NUMPAD } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`63-dialog-r13-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const cdp = await env.context.newCDPSession(pg)
const panelInfo = () => pg.evaluate(() => { const p = document.querySelector('[data-testid^="panel-"]'); if (!p) return null; const sel = [...p.querySelectorAll('[aria-selected="true"], .selected, .sel')].map((e) => e.textContent.trim()).join('|'); const inp = p.querySelector('[data-testid="prompt-text"]'); const ae = document.activeElement; return { sel: sel.slice(0, 30), text: inp?.value ?? null, focus: ae === inp ? 'text' : (ae?.tagName + ':' + (ae?.textContent ?? '').slice(0, 12)) } })
const rowOf = (id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return { adopted: r.adoptedSupplierId, reason: r.adoptReason ?? r.adoptedReason ?? null, status: r.status, subs: p.submissions.slice(-1).map((s) => JSON.stringify(s.changeSet ?? s.rev)), user: JSON.stringify(w.user), name: r.name } }, id)
async function key(t) {
  if (t.startsWith('T:')) return pg.keyboard.type(t.slice(2))
  if (t.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(t.slice(4)); await sleep(80); return pg.keyboard.press('Enter') }
  if (t.startsWith('NP:')) { const d = t.slice(3); return cdpKey(cdp, { key: d, code: 'Numpad' + d, text: d, vk: NUMPAD[d] }) }
  if (t.startsWith('IME:')) return cdp.send('Input.insertText', { text: t.slice(4) })
  if (t.startsWith('CLIP:')) return pg.evaluate((x) => navigator.clipboard.writeText(x), t.slice(5))
  if (t === 'CLICK:text') return pg.getByTestId('prompt-text').click()
  if (t.startsWith('CLICK:opt')) { const n = Number(t.slice(9)); return pg.locator('[data-testid="panel-prompt"] .opt').nth(n - 1).click() }
  return pg.keyboard.press(t)
}
async function run(name, { role = 'design', row = 'R004', col = 'ID', pre = [], toks, expect, check = 'R004' }) {
  await reset(env, { role }); await gotoCell(pg, 1, row, col)
  for (const t of pre) { await key(t); await sleep(40) }
  await installToastLog(pg); await takeToasts(pg)
  const seq = []
  for (const t of toks) { await key(t); await sleep(70); const pi = await panelInfo(); seq.push(`${t}→${pi ? `{sel=${pi.sel} text=${pi.text} focus=${pi.focus}}` : (await state(pg)).mode}`) }
  await sleep(150)
  log({ name, expect, seq, result: await rowOf(check), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).map((x) => x.slice(0, 120)).slice(-3) })
}
const A = ['Shift+A', '2']
await run('G1 理由 クリックで選択肢 3 → 「2社比較」→ Enter', { toks: [...A, 'CLICK:opt3', 'T:2社比較', 'Enter'], expect: '実績/品質: 2社比較（マウスで選んだあとは文字）か 2 で選び直し' })
await run('G2 理由 文字の欄をクリック →「2社比較」→ Enter（断り）→ Shift+Tab → 2 → Enter', { toks: [...A, 'CLICK:text', 'T:2社比較', 'Enter', 'Shift+Tab', '2', 'Enter'], expect: '在庫即納: 2社比較' })
await run('G3 理由 Tab →「3日」→ Shift+Tab → ↓ → Tab →「で入る」→ Enter', { toks: [...A, 'Tab', 'T:3日', 'Shift+Tab', 'ArrowDown', 'Tab', 'T:で入る', 'Enter'], expect: '納期: 3日で入る' })
await run('G4 理由 ↓ ↓（2 在庫即納）→「2社比較」→ Enter', { toks: [...A, 'ArrowDown', 'ArrowDown', 'T:2社比較', 'Enter'], expect: '在庫即納: 2社比較（↑↓ で選んだあとは文字）' })
await run('G5 理由 2 → Tab → Shift+Tab → Shift+Tab → 3 → Enter', { toks: [...A, '2', 'Tab', 'Shift+Tab', 'Shift+Tab', '3', 'Enter'], expect: '実績/品質' })
await run('G6 理由 2 →「急ぎ」→ Shift+Tab → 3 →「。」→ Enter', { toks: [...A, '2', 'T:急ぎ', 'Shift+Tab', '3', 'T:。', 'Enter'], expect: '実績/品質: 急ぎ。' })
await run('G7 理由 2 → テンキー 0 → テンキー 1 → Enter', { toks: [...A, '2', 'NP:0', 'NP:1', 'Enter'], expect: '0 は？・1 は？' })
await run('G8 理由 2 → Tab → IME「２社」→ Shift+Tab → テンキー 3 → Enter', { toks: [...A, '2', 'Tab', 'IME:２社', 'Shift+Tab', 'NP:3', 'Enter'], expect: '実績/品質: ２社' })
await run('G9 変更セット 文字の欄をクリック →「2026-012」→ Shift+Tab → 2 → Enter', { row: 'R010', col: '部品名', pre: ['T:ZZ', 'Enter'], toks: ['Control+Enter', 'CLICK:text', 'T:2026-012', 'Shift+Tab', '2', 'Enter'], expect: '設計起因・2026-012', check: 'R010' })
await run('G10 役割 文字の欄をクリック →「2号 佐藤」→ Enter（既定の設計）', { toks: ['PAL:役割を切り替え', 'CLICK:text', 'T:2号 佐藤', 'Enter'], expect: '設計（2号 佐藤）' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
