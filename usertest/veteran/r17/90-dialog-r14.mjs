// ラウンド14: 選択肢をクリックしたあと文字の欄へ移る（V13-08 の修正）の境目: クリック → ↑↓・数字・Backspace・Shift+Tab、クリック → クリック、変更セットのダイアログ
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state, cdpKey } from './lib17.mjs'
import { NUMPAD } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`90-dialog-r14-${port}${process.env.RUN ?? ""}.json`)
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
await run('H1 クリックで 3 → ↓ → Enter', { toks: [...A, 'CLICK:opt3', 'ArrowDown', 'Enter'], expect: '4 番目（↓ は選択肢を動かす）か 3 のまま' })
await run('H2 クリックで 3 → 2 → Enter', { toks: [...A, 'CLICK:opt3', '2', 'Enter'], expect: '実績/品質: 2（文字）— クリック後は数字は文字' })
await run('H3 クリックで 3 → Shift+Tab → 2 → Enter', { toks: [...A, 'CLICK:opt3', 'Shift+Tab', '2', 'Enter'], expect: '在庫即納（Shift+Tab で選択肢に戻って数字で選ぶ）' })
await run('H4 クリックで 3 → クリックで 1 →「急ぎ」→ Enter', { toks: [...A, 'CLICK:opt3', 'CLICK:opt1', 'T:急ぎ', 'Enter'], expect: '1 番目: 急ぎ' })
await run('H5 2 で選ぶ → 文字の欄をクリック → クリックで 3 → Enter', { toks: [...A, '2', 'CLICK:text', 'CLICK:opt3', 'Enter'], expect: '実績/品質' })
await run('H6 クリックで 3 → テンキー 1 → Enter', { toks: [...A, 'CLICK:opt3', 'NP:1', 'Enter'], expect: '実績/品質: 1（文字）' })
await run('H7 変更セット クリックで 2 → 「ECN-1」→ Enter', { row: 'R010', col: '部品名', pre: ['T:ZZ', 'Enter'], toks: ['Control+Enter', 'CLICK:opt2', 'T:ECN-1', 'Enter'], expect: '2 番目の理由・ECN-1', check: 'R010' })
await run('H8 変更セット クリックで 2 → 「2026-012」→ Enter', { row: 'R010', col: '部品名', pre: ['T:ZZ', 'Enter'], toks: ['Control+Enter', 'CLICK:opt2', 'T:2026-012', 'Enter'], expect: '2 番目の理由・2026-012', check: 'R010' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
