// ラウンド11: F2 の切り替え（入力 ⇄ 編集）× 列の種類 × 矢印・Home・Shift。表示（入力/編集）、カーソル位置、確定先を記録
import { open, reset, sleep, state, logger, installToastLog, takeToasts, snap, diffRows, gotoCell } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`21-f2-modes-${port}.json`)
const caret = () => pg.evaluate(() => { const e = document.querySelector('[data-testid="cell-editor"]'); return e ? `${e.value}|${e.selectionStart}-${e.selectionEnd}` : null })
const cand = () => pg.evaluate(() => document.querySelector('.candidates, [data-testid="candidates"]')?.textContent?.slice(0, 60) ?? null)
async function run(name, { role = 'design', view = 1, row = 'R010', col = '部品名', toks, expect }) {
  await reset(env, { role })
  const ok = await gotoCell(pg, view, row, col)
  await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg)
  const seq = [`start(${ok})→${(await state(pg)).cursor}`]
  for (const t of toks) {
    if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); await pg.keyboard.press('Enter') }
    else await pg.keyboard.press(t)
    await sleep(60)
    const s = await state(pg); const c = await caret()
    seq.push(`${t}→${s.cursor}/${s.mode}${c != null ? '[' + c + ']' : ''}${s.panel ? '{' + s.panel + '}' : ''}`)
  }
  const b = await snap(pg)
  log({ name, expect, seq, diff: diffRows(a, b).slice(0, 4), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
}
const TEXT = [['部品名', 'R010'], ['型式', 'R010'], ['備考', 'R010']]
for (const [col, row] of TEXT) {
  await run(`${col}: 打って ab → F2 → ← → X → Enter`, { row, col, toks: ['T:ab', 'F2', 'ArrowLeft', 'T:X', 'Enter'], expect: '表示 入力→編集、← は文字の中、値 aXb で確定、下へ' })
  await run(`${col}: 打って ab → F2 → F2 → ←`, { row, col, toks: ['T:ab', 'F2', 'F2', 'ArrowLeft'], expect: '入力に戻り ← で確定して左へ' })
  await run(`${col}: Enter で編集 → F2 → ↓`, { row, col, toks: ['Enter', 'F2', 'ArrowDown'], expect: '編集→入力、↓ で確定して下へ（値は変わらない）' })
  await run(`${col}: F2 で編集 → F2 → →`, { row, col, toks: ['F2', 'F2', 'ArrowRight'], expect: '入力、→ で右へ' })
  await run(`${col}: 打って ab → F2 → Shift+Home → Z → Tab`, { row, col, toks: ['T:ab', 'F2', 'Shift+Home', 'T:Z', 'Tab'], expect: '値 Z で確定、右へ' })
  await run(`${col}: 打って ab → F2 → ↑ → ↓ → Enter`, { row, col, toks: ['T:ab', 'F2', 'ArrowUp', 'ArrowDown', 'Enter'], expect: '編集中の ↑↓ は文字の中（行は動かない）、ab で確定' })
}
await run('必要数: 打って 12 → F2 → ← → 3 → Enter', { row: 'R010', col: '必要数', toks: ['T:12', 'F2', 'ArrowLeft', 'T:3', 'Enter'], expect: '132' })
await run('必要数: Enter（全選択）→ F2 → ←', { row: 'R010', col: '必要数', toks: ['Enter', 'F2', 'ArrowLeft'], expect: '入力→ ← で確定して左' })
await run('必要数: 打って abc（読めない）→ F2 → F2 → ↓', { row: 'R010', col: '必要数', toks: ['T:abc', 'F2', 'F2', 'ArrowDown'], expect: '確定せず残る' })
await run('調達区分: 打って s → F2 → ↓ → ↓ → Enter', { row: 'R010', col: '調達区分', toks: ['T:s', 'F2', 'ArrowDown', 'ArrowDown', 'Enter'], expect: '編集では ↓ で候補を回す' })
await run('調達区分: Enter → F2 → ↓', { row: 'R010', col: '調達区分', toks: ['Enter', 'F2', 'ArrowDown'], expect: '入力では ↓ で確定して下へ' })
await run('調達区分: 打って sh → ↓（入力）', { row: 'R010', col: '調達区分', toks: ['T:sh', 'ArrowDown'], expect: '指定商社で確定して下へ' })
// 日付（購買 9 の入荷予定）
await run('購買 入荷予定: 打って 2026/12/1 → F2 → ← ×3 → 0 → Enter', { role: 'purchasing', view: 9, row: 'R004', col: '入荷予定', toks: ['T:2026/12/1', 'F2', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'T:0', 'Enter'], expect: '2026/102/1 → 読めない or 編集位置どおり' })
await run('購買 単価: 打って 120 → F2 → → → Tab', { role: 'purchasing', view: 9, row: 'R004', col: '単価', toks: ['T:120', 'F2', 'ArrowRight', 'Tab'], expect: '→ は文字の中、Tab で確定して右' })
// 購買 6・8 の自動の入力（editAuto）
await run('購買 6: 開いた直後 F2 → ↓', { role: 'purchasing', view: 6, row: 'R004', col: '単価', toks: ['F2', 'ArrowDown'], expect: '?' })
// 行なし・見出し・書けない列・チェックの列・ID の列での F2
await run('行なし（4 で R054 を直して外れた）→ F2', { view: 4, row: 'R054', col: '必要数', toks: ['T:5', 'Enter', 'F2'], expect: 'Enter で次の行へ（外れたとき）→ F2' })
await run('行なし（4 で 5 → →）→ F2 → T:x', { view: 4, row: 'R054', col: '必要数', toks: ['T:5', 'ArrowRight', 'F2', 'T:x'], expect: '何もしない・知らせる' })
await run('見出し（分類）→ F2', { row: 'R013', col: '部品名', toks: ['ArrowUp', 'F2', 'T:a'], expect: '見出しの知らせ' })
await run('購買の 部品名（書けない）→ F2', { role: 'purchasing', view: 1, row: 'R010', col: '部品名', toks: ['F2'], expect: '理由の知らせ' })
await run('設計の 発注（チェック）→ F2', { view: 3, row: 'R001', col: '発注', toks: ['F2'], expect: '?' })
await run('ID の列 → F2', { row: 'R010', col: 'ID', toks: ['F2'], expect: '?' })
await run('PM 7 → F2', { role: 'pm', view: 7, row: 'R003', col: '部品名', toks: ['F2'], expect: '?' })
// 入力中の F2 連打・F2 と Esc
await run('打って ab → F2 ×5 → →', { row: 'R010', col: '部品名', toks: ['T:ab', 'F2', 'F2', 'F2', 'F2', 'F2', 'ArrowRight'], expect: '奇数回で 編集 → → は文字の中' })
await run('打って ab → F2 → Esc', { row: 'R010', col: '部品名', toks: ['T:ab', 'F2', 'Escape'], expect: '取り消し' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
