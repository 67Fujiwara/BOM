// ラウンド11: 文字欄のあるダイアログで数字と文字（V10-02 の再確認と新しい形）。採用理由・変更セット・役割の切り替え
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state, snap, diffRows } from './lib13.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`22-dialog-digits2-${port}.json`)
const panelInfo = () => pg.evaluate(() => { const p = document.querySelector('[data-testid^="panel-"]'); if (!p) return null; const sel = [...p.querySelectorAll('[aria-selected="true"], .selected, .sel')].map((e) => e.textContent.trim()).join('|'); const inp = p.querySelector('input[type=text], input:not([type]), textarea'); return { id: p.dataset.testid, sel: sel.slice(0, 40), text: inp?.value ?? null } })
const subs = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.submissions.map((s) => s.changeSet ? JSON.stringify(s.changeSet) : `rev${s.rev}`).slice(-2) })
const user = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return JSON.stringify(w.user) })
async function run(name, { role = 'design', view = 1, row = 'R004', col = 'ID', pre = [], toks, extra }) {
  await reset(env, { role }); await gotoCell(pg, view, row, col)
  for (const t of pre) await key(t)
  await installToastLog(pg); await takeToasts(pg); const a = await snap(pg)
  const seq = []
  for (const t of toks) { await key(t); await sleep(70); const s = await state(pg); const pi = await panelInfo(); seq.push(`${t}→${s.mode}${pi ? `{${pi.id} sel=${pi.sel} text=${pi.text}}` : ''}`) }
  await sleep(150); const b = await snap(pg)
  log({ name, seq, diff: diffRows(a, b).filter((d) => /adoptReason|weights|flags/.test(d)).slice(0, 4), extra: extra ? await extra() : undefined, toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
}
async function key(t) {
  if (t.startsWith('T:')) return pg.keyboard.type(t.slice(2))
  if (t.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(t.slice(4)); await sleep(80); return pg.keyboard.press('Enter') }
  return pg.keyboard.press(t)
}
// 採用理由（R004 は見積済。2 = ミスミ で 1 位以外）
await run('A1 理由 2 → 3（選び直しのつもり）→ Enter', { toks: ['Shift+A', '2', '2', '3', 'Enter'] })
await run('A2 理由 ↓（1 納期）→ 補足「2社比較」→ Enter', { toks: ['Shift+A', '2', 'ArrowDown', 'T:2社比較', 'Enter'] })
await run('A3 補足 a → Backspace → 「3日」（選んでいない）→ Enter', { toks: ['Shift+A', '2', 'T:a', 'Backspace', 'T:3日', 'Enter'] })
await run('A4 理由 9（範囲外）→ 2 → 「10日」→ Enter', { toks: ['Shift+A', '2', '9', '2', 'T:10日', 'Enter'] })
await run('A5 理由 2 → 補足「2026-012」→ ↑ → Enter', { toks: ['Shift+A', '2', '2', 'T:2026-012', 'ArrowUp', 'Enter'] })
await run('A6 理由ダイアログで Alt+4', { toks: ['Shift+A', '2', 'Alt+4', 'Escape'] })
await run('A7 理由ダイアログで Numpad3 → 「日」→ Enter', { toks: ['Shift+A', '2', 'Numpad3', 'T:日で入る', 'Enter'] })
// 変更セット（R010 部品名を変えて公開）
await run('B1 変更セット 2 → 「2026-012」→ Enter', { col: '部品名', row: 'R010', pre: ['T:変更品', 'Enter', 'ArrowUp'], toks: ['Control+Enter', '2', 'T:2026-012', 'Enter'], extra: subs })
await run('B2 変更セット 番号から（選ばずに「2026-012」）→ Enter', { col: '部品名', row: 'R010', pre: ['T:変更品', 'Enter', 'ArrowUp'], toks: ['Control+Enter', 'T:2026-012', 'Enter'], extra: subs })
await run('B3 変更セット ↓ → 「ECN-1」→ Enter', { col: '部品名', row: 'R010', pre: ['T:変更品', 'Enter', 'ArrowUp'], toks: ['Control+Enter', 'ArrowDown', 'T:ECN-1', 'Enter'], extra: subs })
// 役割の切り替え（既定の選択あり）
await run('C1 役割の切り替え: 2 → 氏名「2号 佐藤」→ Enter', { toks: ['PAL:役割を切り替え', '2', 'T:2号 佐藤', 'Enter'], extra: user })
await run('C2 役割の切り替え: 氏名「3班 鈴木」（選ばずに）→ Enter', { toks: ['PAL:役割を切り替え', 'T:3班 鈴木', 'Enter'], extra: user })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
