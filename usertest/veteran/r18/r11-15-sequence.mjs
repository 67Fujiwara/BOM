// ラウンド10: 順番に直すモードで、直して行が 4 から外れる（R054 必要数）→ Enter → 次の問題の候補が開くか。打って始めた入力の → / ↓ でも
import { open, reset, sleep, logger, state, snap, diffRows, installToastLog, takeToasts } from './lib18.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`15-sequence-${port}.json`)
const panelText = () => pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 90) ?? null)
async function run(name, finishKey) {
  await reset(env); await pg.keyboard.press('Alt+4'); await sleep(50)
  await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R054'); await pg.keyboard.press('Enter'); await sleep(80)
  await pg.keyboard.press('Control+Shift+F'); await sleep(150)
  await installToastLog(pg); await takeToasts(pg); const a = await snap(pg)
  const seq = [`start→${(await state(pg)).cursor}/${await panelText()}`]
  await pg.keyboard.press('1'); await sleep(100)
  seq.push(`1→${(await state(pg)).cursor}/${(await state(pg)).mode}/${await panelText()}`)
  await pg.keyboard.type('5'); await pg.keyboard.press(finishKey); await sleep(200)
  const s = await state(pg); seq.push(`5+${finishKey}→${s.cursor}/${s.mode}/${await panelText()}`)
  const b = await snap(pg)
  log({ name, seq, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存')).slice(-3) })
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
await run('順番に直す: R054 必要数 5 Enter', 'Enter')
await run('順番に直す: R054 必要数 5 ↓', 'ArrowDown')
await run('順番に直す: R054 必要数 5 →', 'ArrowRight')
await run('順番に直す: R054 必要数 5 Tab', 'Tab')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
