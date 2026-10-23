// ラウンド10: 自分の直しで行が外れて選択が外れた直後の → / Tab / Home（1 タブだけ）。続けて打った値がどの行に入るか
import { open, reset, sleep, logger, state, snap, diffRows, gotoCell, installToastLog, takeToasts } from './lib12.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`16-deselect-arrow-${port}.json`)
async function run(name, keys) {
  await reset(env); await gotoCell(pg, 4, 'R054', '必要数'); await installToastLog(pg); await takeToasts(pg); const a = await snap(pg)
  const seq = []
  for (const k of keys) { if (k.startsWith('T:')) await pg.keyboard.type(k.slice(2)); else await pg.keyboard.press(k); await sleep(80); const s = await state(pg); seq.push(`${k}→${s.view}/${s.cursor}/${s.mode}`) }
  log({ name, seq, diff: diffRows(a, b0(await snap(pg))), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存')).slice(-3) })
  function b0(x) { return x }
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
await run('R054 必要数 5 → → 7 Enter（右へ 2 回）', ['T:5', 'ArrowRight', 'ArrowRight', 'T:7', 'Enter'])
await run('R054 必要数 5 Tab Tab 個 Enter（右へ 2 回）', ['T:5', 'Tab', 'Tab', 'T:m', 'Enter'])
await run('R054 必要数 5 → ↓ 7 Enter', ['T:5', 'ArrowRight', 'ArrowDown', 'T:7', 'Enter'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
