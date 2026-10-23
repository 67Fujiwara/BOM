// ラウンド11: F8 の流れ（ビュー 1/2/4/5・絞り込み・セルの絞り込み・役割）。V10-01 / V10-06 / V7-03 の再確認と新しい形
// 「↓ で動いたあとの F8」「F8 のあとに絞り込み」「問題の無いビューからの F8」「購買の F8」
import { open, reset, sleep, state, logger, installToastLog, takeToasts, snap, diffRows } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`20-f8-more-${port}.json`)
const visOrder = () => pg.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] [data-row-id]')].map((e) => e.dataset.rowId).filter((x, i, a) => a.indexOf(x) === i))
async function run(name, view, toks, expect, role = 'design') {
  await reset(env, { role }); await pg.keyboard.press(`Alt+${view}`); await sleep(60); await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg)
  const seq = [`start→${(await state(pg)).cursor}`]
  for (const t of toks) {
    if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('F:')) { await pg.keyboard.press('Control+f'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t.startsWith('C:')) { await pg.keyboard.press('Home'); for (let i = 0; i < 40 && !(await state(pg)).cursor.endsWith(' ' + t.slice(2)); i++) await pg.keyboard.press('ArrowRight') }
    else if (t.startsWith('DOWN')) { const n = Number(t.slice(4)); for (let i = 0; i < n; i++) await pg.keyboard.press('ArrowDown') }
    else if (t === 'VIS') { seq.push('vis=' + (await visOrder()).slice(0, 14).join(',')); continue }
    else if (t === 'RELOAD') { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(200) }
    else await pg.keyboard.press(t)
    await sleep(70)
    const s = await state(pg); seq.push(`${t}→${s.view.replace('view-', 'v')}/${s.cursor}${s.mode !== 'ナビ' ? '(' + s.mode + ')' : ''}${s.panel ? '[' + s.panel + ']' : ''}${s.filter ? '{f=' + s.filter + '}' : ''}`)
  }
  const b = await snap(pg)
  log({ name, expect, seq, diff: diffRows(a, b).slice(0, 4), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
}
// A: ↓ で動いたあとの F8（前に飛んだ位置から続けるのか、カーソルの下か）
await run('A1 1: F8（R005）→ ↓×15（R020）→ F8', 1, ['F8', 'DOWN15', 'F8'], 'R022（カーソルより下で最も近い）')
await run('A2 1: F8×4（R022）→ ↑×15（R007）→ F8', 1, ['F8', 'F8', 'F8', 'F8', 'DOWN0', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'F8'], 'R009（R007 より下で最も近い）')
await run('A3 1: F8（R005）→ Ctrl+↓（最後）→ Shift+F8', 1, ['F8', 'Control+ArrowDown', 'Shift+F8'], 'R061（最後の行より上で最も近い）')
await run('A4 1: F8（R005）→ PageDown → F8', 1, ['F8', 'PageDown', 'F8'], 'PageDown 先より下')
await run('A5 2: F8（R005）→ ↓×20 → F8', 2, ['F8', 'VIS', 'DOWN20', 'F8'], 'カーソルより下')
// B: F8 のあとに絞り込み（前に飛んだ位置の番号が別の一覧のもの）
await run('B1 1: F8×6（R054）→ Ctrl+F「オムロン」→ F8 ×3', 1, ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F:オムロン', 'VIS', 'F8', 'F8', 'F8'], '絞り込みの中の先頭の問題から順に')
await run('B2 1: F8×3（R016）→ Ctrl+F「リレー」→ F8 → Esc で解除 → F8', 1, ['F8', 'F8', 'F8', 'F:リレー', 'F8', 'Escape', 'F8'], 'リレーの問題 → 解除後は続き')
await run('B3 1: Ctrl+F「R0」→ F8 ×8', 1, ['F:R0', 'VIS', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8'], '見えている並びで一周')
await run('B4 5: Ctrl+F「リレー」→ F8 ×2', 5, ['F:リレー', 'VIS', 'F8', 'F8'], '5 の中の絞り込み')
await run('B5 4: Ctrl+F「R05」→ F8 ×3', 4, ['F:R05', 'VIS', 'F8', 'F8', 'F8'], 'R054 → R054 …')
// C: 問題の無いビューからの F8
await run('C1 3: F8 ×3', 3, ['F8', 'F8', 'F8'], '1 すべての先頭の問題（R005）から順に')
await run('C2 7: F8 ×2', 7, ['F8', 'F8'], 'R005 から')
await run('C3 1: Ctrl+F「ヒューズ」（問題なし）→ F8 ×2', 1, ['F:ヒューズ', 'VIS', 'F8', 'F8'], '知らせて 1 すべての問題へ')
// D: 4 で直して外れる → F8
await run('D1 4: F8 で R054 → 5 Tab（外れる）→ F8 → F8', 4, ['F8', 'F8', 'F8', 'F8', 'F8', 'T:5', 'Tab', 'F8', 'F8'], 'R005 → R061')
await run('D2 4: Ctrl+G R022 → 型式を直す（F2 Ctrl+A）→ Enter → F8', 4, ['G:R022', 'C:型式', 'VIS', 'F8'], '確認')
// E: 購買
await run('E1 購買 1: F8 ×4', 1, ['F8', 'F8', 'F8', 'F8'], '購買の問題', 'purchasing')
await run('E2 購買 9: F8 ×3', 9, ['VIS', 'F8', 'F8', 'F8'], '9 の中', 'purchasing')
await run('E3 購買 2: F8 ×3', 2, ['VIS', 'F8', 'F8', 'F8'], '2 の中', 'purchasing')
await run('E4 PM 7: F8 ×2', 7, ['VIS', 'F8', 'F8'], 'PM', 'pm')
// F: リロード後
await run('F1 1: F8×3（R016）→ リロード → F8', 1, ['F8', 'F8', 'F8', 'RELOAD', 'F8'], 'R022')
await run('F2 1: F8 → ↓×20 → リロード → F8', 1, ['F8', 'DOWN20', 'RELOAD', 'F8'], 'カーソルより下（R041）')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
