// ラウンド12: 文字欄のあるダイアログ「数字は Tab か文字を打つまで選ぶ」（N11-01 の修正）を、数字 → 文字 → Tab の順の組み合わせで
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state, cdpKey } from './lib20.mjs'
import { NUMPAD } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`42-dialog-tab-${port}.json`)
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
const A = ['Shift+A', '2'] // R004 で 2 位（ミスミ）を選ぶ → 理由のダイアログ
await run('D1 理由 2 → Tab → 「3日で入る」→ Enter', { toks: [...A, '2', 'Tab', 'T:3日で入る', 'Enter'], expect: '在庫即納: 3日で入る' })
await run('D2 理由 2 → 3（選び直し）→ Tab → 「5日」→ Enter', { toks: [...A, '2', '3', 'Tab', 'T:5日', 'Enter'], expect: '3 番: 5日' })
await run('D3 理由 2 →「3日で入る」（Tab なし）→ Enter', { toks: [...A, '2', 'T:3日で入る', 'Enter'], expect: '仕様: 3 を選び直し「日で入る」' })
await run('D4 理由 Tab → 2（選ぶ前に Tab）→ Enter', { toks: [...A, 'Tab', '2', 'Enter'], expect: '理由 未選択・補足「2」→ その他: 2 ?' })
await run('D5 理由 2 → Tab → Tab（ボタンへ）→ 「3日」→ Enter', { toks: [...A, '2', 'Tab', 'Tab', 'T:3日', 'Enter'], expect: '3日 がどこかに入る（捨てない）' })
await run('D6 理由 2 → Shift+Tab →「3日」→ Enter', { toks: [...A, '2', 'Shift+Tab', 'T:3日', 'Enter'], expect: '在庫即納: 3日 か ボタン' })
await run('D7 理由 2 → a → Backspace → 3 → Enter', { toks: [...A, '2', 'T:a', 'Backspace', '3', 'Enter'], expect: '在庫即納: 3（文字を打ったあとは文字）' })
await run('D8 理由 2 → Tab → 3 → ↓ → 4 → Enter', { toks: [...A, '2', 'Tab', '3', 'ArrowDown', '4', 'Enter'], expect: '↓ のあと 4 は文字' })
await run('D9 理由 テンキー 2 → テンキー 3 → Tab → テンキー 5 → Enter', { toks: [...A, 'NP:2', 'NP:3', 'Tab', 'NP:5', 'Enter'], expect: '3 番: 5' })
await run('D10 理由 2 → IME「３日で入る」（全角）→ Enter', { toks: [...A, '2', 'IME:３日で入る', 'Enter'], expect: '在庫即納: ３日で入る' })
await run('D11 理由 2 → 補足を貼り付け「3日で入る」→ Enter', { toks: [...A, '2', 'CLIP:3日で入る', 'Control+v', 'Enter'], expect: '在庫即納: 3日で入る' })
await run('D12 理由 2 → Tab → 「3日」→ Backspace×2 → 4 → Enter', { toks: [...A, '2', 'Tab', 'T:3日', 'Backspace', 'Backspace', '4', 'Enter'], expect: '在庫即納: 4（欄に移ったあとは文字）' })
await run('D13 理由 2 → Esc → もう一度 Shift+A 2 → 3 → Enter', { toks: [...A, '2', 'Tab', 'Escape', ...A, '3', 'Enter'], expect: '3 番（前のダイアログの Tab を引き継がない）' })
await run('D14 理由 0（範囲外）→ Enter', { toks: [...A, '0', 'Enter'], expect: '0 は？' })
await run('D15 理由 Space → Enter', { toks: [...A, ' ', 'Enter'], expect: '?' })
// 変更セット（R010 部品名を変えて Ctrl+Enter）
const PUB = ['G:R010x', 'Escape']
const preP = ['T:変更品', 'Enter', 'ArrowUp']
await run('E1 変更セット Tab → 「2026-012」→ Enter', { row: 'R010', col: '部品名', pre: preP, toks: ['Control+Enter', 'Tab', 'T:2026-012', 'Enter'], expect: 'その他・2026-012', check: 'R010' })
await run('E2 変更セット 2 → Tab → 「2026-012」→ Enter', { row: 'R010', col: '部品名', pre: preP, toks: ['Control+Enter', '2', 'Tab', 'T:2026-012', 'Enter'], expect: '2 番・2026-012', check: 'R010' })
await run('E3 変更セット 「2026-012」（Tab なし）→ Enter', { row: 'R010', col: '部品名', pre: preP, toks: ['Control+Enter', 'T:2026-012', 'Enter'], expect: '仕様: 2 番・026-012（案内あり）', check: 'R010' })
await run('E4 変更セット 2 → 1 → 0（0 は？）→ Enter', { row: 'R010', col: '部品名', pre: preP, toks: ['Control+Enter', '2', '1', '0', 'Enter'], expect: '?', check: 'R010' })
// 役割の切り替え
await run('F1 役割 2 → Tab → 「2号 佐藤」→ Enter', { toks: ['PAL:役割を切り替え', '2', 'Tab', 'T:2号 佐藤', 'Enter'], expect: '購買・2号 佐藤' })
await run('F2 役割 Tab →「3班 鈴木」→ Enter', { toks: ['PAL:役割を切り替え', 'Tab', 'T:3班 鈴木', 'Enter'], expect: '設計のまま・3班 鈴木' })
await run('F3 役割 「3班 鈴木」（Tab なし）→ Enter', { toks: ['PAL:役割を切り替え', 'T:3班 鈴木', 'Enter'], expect: '仕様: PM・班 鈴木' })
await run('F4 役割 鈴木 → Backspace×2 → 3 → Enter', { toks: ['PAL:役割を切り替え', 'T:鈴木', 'Backspace', 'Backspace', '3', 'Enter'], expect: '設計・3' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
