// ラウンド10: F8 の流れ（V9-01 の再確認＋表示順と一覧の順の違い）。ビュー 1（ID 順）・4（種別順）・並べ替え後・絞り込み後で F8 を続けて押し、行き先を記録
import { open, reset, sleep, state, logger, installToastLog, takeToasts } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`01-f8-view-${port}.json`)
const visOrder = () => pg.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] [data-row-id]')].map((e) => e.dataset.rowId).filter((x, i, a) => a.indexOf(x) === i))
async function run(name, view, toks) {
  await reset(env); await pg.keyboard.press(`Alt+${view}`); await sleep(60); await installToastLog(pg); await takeToasts(pg)
  const seq = []
  for (const t of toks) {
    if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('F:')) { await pg.keyboard.press('Control+f'); await pg.keyboard.type(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t === 'VIS') { seq.push('vis=' + (await visOrder()).slice(0, 12).join(',')); continue }
    else await pg.keyboard.press(t)
    await sleep(70)
    const s = await state(pg); seq.push(`${t}→${s.cursor}${s.mode !== 'ナビ' ? '(' + s.mode + ')' : ''}${s.panel ? '[' + s.panel + ']' : ''}`)
  }
  log({ name, seq, toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
}
await run('V1 1 で Ctrl+Home → F8 ×8', 1, ['Control+Home', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8'])
await run('V1b 1 で Ctrl+End → Shift+F8 ×8', 1, ['Control+End', 'VIS', 'Shift+F8', 'Shift+F8', 'Shift+F8', 'Shift+F8', 'Shift+F8', 'Shift+F8', 'Shift+F8', 'Shift+F8'])
await run('V1c 1 で Ctrl+End → F8（下に問題なし）', 1, ['Control+End', 'F8'])
await run('V1d 1 の最終行 Ctrl+G R061 → ↓ → F8', 1, ['G:R061', 'ArrowDown', 'F8'])
await run('V1e 1 で並べ替え（ID 列 Shift+S 降順）→ Ctrl+Home → F8 ×4', 1, ['Home', 'Shift+S', 'VIS', 'Control+Home', 'F8', 'F8', 'F8', 'F8'])
await run('V4 4 で Ctrl+G R005 → Alt+x → F8', 4, ['G:R005', 'VIS', 'Alt+x', 'VIS', 'F8'])
await run('V4b 4 で Ctrl+G R005（型式）→ Alt+x → F8', 4, ['G:R005', 'ArrowRight', 'ArrowRight', 'Alt+x', 'VIS', 'F8'])
await run('V4c 4 で F8 → Shift+F8（先頭から上へ回る）', 4, ['Shift+F8', 'Shift+F8'])
await run('V2 2 購買提出用で F8 ×3', 2, ['F8', 'F8', 'F8'])
await run('V5 絞り込み「リレー」で F8', 1, ['F:リレー', 'VIS', 'F8', 'F8'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
