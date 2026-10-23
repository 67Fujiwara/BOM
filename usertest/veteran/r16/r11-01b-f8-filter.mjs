// ラウンド10: 絞り込み中・3 発注入荷・5 変更あり・隠した行で F8 → ビュー・絞り込みが黙って替わるか
import { open, reset, sleep, state, logger, installToastLog, takeToasts } from './lib16.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`01b-f8-filter-${port}.json`)
async function run(name, prep, keys) {
  await reset(env); await prep(); await sleep(80); await installToastLog(pg); await takeToasts(pg)
  const seq = [`start→${JSON.stringify(await state(pg)).slice(0, 0)}${(await state(pg)).view}/${(await state(pg)).cursor}/f=${(await state(pg)).filter}`]
  for (const k of keys) { await pg.keyboard.press(k); await sleep(80); const s = await state(pg); seq.push(`${k}→${s.view}/${s.cursor}/f=${s.filter}`) }
  log({ name, seq, toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存')).slice(-3) })
}
await run('絞り込み「リレー」→ F8 ×3', async () => { await pg.keyboard.press('Control+f'); await pg.keyboard.type('リレー'); await pg.keyboard.press('Enter') }, ['F8', 'F8', 'F8'])
await run('3 発注・入荷 → F8 ×2', async () => { await pg.keyboard.press('Alt+3'); await pg.keyboard.press('ArrowDown') }, ['F8', 'F8'])
await run('5 変更あり → F8 ×2', async () => { await pg.keyboard.press('Alt+5'); await pg.keyboard.press('ArrowDown') }, ['F8', 'F8'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
