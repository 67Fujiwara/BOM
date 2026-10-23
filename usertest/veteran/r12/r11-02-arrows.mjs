// ラウンド10: 打って始めた入力（Excel の入力モード）と Enter / F2 で始めた編集（編集モード）の矢印・Home・F2・Shift+矢印。
// 列の種類（文字・数・選択・日付）× キー。確定した値・カーソル・モードを記録
import { open, reset, gotoCell, snap, diffRows, sleep, state, logger, installToastLog, takeToasts, typeSeqM } from './lib12.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`02-arrows-${port}.json`)
const caret = () => pg.evaluate(() => { const e = document.querySelector('[data-testid="cell-editor"]'); return e ? [e.selectionStart, e.selectionEnd, e.value] : null })
async function run(name, view, row, col, steps, role = 'design') {
  await reset(env, { role }); await gotoCell(pg, view, row, col); await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const seq = [`start→${(await state(pg)).cursor}`]
  for (const t of steps) {
    if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('M:')) await typeSeqM(pg, t.slice(2).split(' ').map((k) => [k, 0]))
    else await pg.keyboard.press(t)
    await sleep(60)
    const s = await state(pg); const c = await caret()
    seq.push(`${t}→${s.cursor}/${s.mode}${c ? `[${c[2]}|${c[0]}-${c[1]}]` : ''}${s.panel ? '/' + s.panel : ''}`)
  }
  const b = await snap(pg)
  log({ name, seq, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
const COLS = [['部品名', 'T:Xa'], ['必要数', 'T:7'], ['単位', 'T:m'], ['必要日(固定)', 'T:2026/12/1'], ['調達区分', 'T:客'], ['備考', 'T:<5']]
for (const [col, ty] of COLS) for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) await run(`typed ${col} ${k}`, 1, 'R010', col, [ty, k])
for (const [col, ty] of COLS) await run(`F2 ${col} 打って ← ← → ↑ ↓ Enter`, 1, 'R010', col, ['F2', ty, 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'])
for (const [col] of COLS) await run(`Enter で始めて ← → Enter`, 1, 'R010', col, ['Enter', 'ArrowLeft', 'ArrowRight', 'Enter'])
await run('typed 型式 → F2 → ←（Excel は F2 で編集モードへ）', 1, 'R010', '型式', ['T:MY4N', 'F2', 'ArrowLeft', 'T:X', 'Enter'])
await run('typed 型式 → Home → X → Enter', 1, 'R010', '型式', ['T:MY4N', 'Home', 'T:X', 'Enter'])
await run('typed 型式 → End → Enter', 1, 'R010', '型式', ['T:MY4N', 'End', 'Enter'])
await run('typed 型式 → Shift+← → Enter', 1, 'R010', '型式', ['T:MY4N', 'Shift+ArrowLeft', 'Enter'])
await run('typed 型式 → Ctrl+← → Enter', 1, 'R010', '型式', ['T:MY4N AB', 'Control+ArrowLeft', 'Enter'])
await run('typed 型式 → Alt+↓', 1, 'R010', '型式', ['T:MY4N', 'Alt+ArrowDown'])
await run('typed 必要数 abc → ↓（読めない）→ Esc', 1, 'R010', '必要数', ['T:abc', 'ArrowDown', 'Escape'])
await run('typed 必要数 12 ↓ 34 ↓ 56 ↓（ページ内 0ms）', 1, 'R010', '必要数', ['M:1 2 ArrowDown 3 4 ArrowDown 5 6 ArrowDown'])
await run('typed 必要数 12 → 34 → （ページ内 0ms・右へ）', 1, 'R010', '部品名', ['M:a b ArrowRight c d ArrowRight', 'Escape'])
await run('R001 で typed ↑（上が無い）', 1, 'R001', '必要数', ['T:9', 'ArrowUp'])
await run('最後の列で typed →', 1, 'R010', '備考', ['End', 'T:z', 'ArrowRight'])
await run('単位 m 候補 ↓ で回す → → で確定', 1, 'R010', '単位', ['T:m', 'ArrowDown', 'ArrowRight'])
await run('4 で R054 必要数 typed 5 → →（直して外れる）→ 7', 4, 'R054', '必要数', ['T:5', 'ArrowRight', 'T:7', 'Enter'])
await run('4 で R054 必要数 typed 5 → ↑（直して外れる）', 4, 'R054', '必要数', ['T:5', 'ArrowUp', 'T:7', 'Enter'])
await run('4 で R054 必要数 typed 5 → ↓（直して外れる）', 4, 'R054', '必要数', ['T:5', 'ArrowDown'])
await run('4 で R005 型式 typed 直す → ↑（行が 4 の中で動く）', 4, 'R005', '型式', ['T:MY4N-GS DC24', 'ArrowUp'])
await run('購買 9 発注数 typed 10 → →', 9, 'R020', '発注数', ['T:10', 'ArrowRight'], 'purchasing')
await run('購買 3 入荷予定 typed 2026/12/1 → ←', 3, 'R001', '入荷予定', ['T:2026/12/1', 'ArrowLeft'], 'purchasing')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
