// ラウンド10: 理由・補足の文字欄があるダイアログ（数字で選ぶ・Enter で確定）で、補足を数字から打つ（「3日で入る」「2社比較」）。
// 1 位以外を採用（設計: ID の列で Shift+A → 商社 2 → 理由のダイアログ）
import { open, reset, sleep, state, snap, diffRows, logger, installToastLog, takeToasts } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`09-dialog-digits-${port}.json`)
const panelText = () => pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null)
const quoted = async () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.filter((r) => r.status === 'quoted' && !r.adoptedSupplierId).map((r) => r.id) })
async function run(name, steps) {
  await reset(env, { role: 'design' }); const ids = await quoted(); const id = ids[0]
  await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(id); await pg.keyboard.press('Enter'); await sleep(60); await pg.keyboard.press('Home')
  await installToastLog(pg); await takeToasts(pg); const a = await snap(pg)
  const seq = []
  for (const k of steps) { if (k.startsWith('T:')) await pg.keyboard.type(k.slice(2)); else await pg.keyboard.press(k); await sleep(100); const s = await state(pg); seq.push(`${k}→${s.panel ?? s.mode}${s.panel ? ':' + ((await panelText()) ?? '').slice(0, 70) : ''}`) }
  const b = await snap(pg)
  log({ name, row: id, seq, diff: diffRows(a, b).filter((d) => !d.includes('statusChangedAt')).slice(0, 6), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存')).slice(-4) })
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
await run('理由 2 → 補足「3日で入る」→ Enter', ['Shift+A', '2', '2', 'T:3日で入る', 'Enter'])
await run('理由を選ばずに補足「2社比較」→ Enter', ['Shift+A', '2', 'T:2社比較', 'Enter'])
await run('理由 1 → 補足「ok」→ Enter（対照）', ['Shift+A', '2', '1', 'T:ok', 'Enter'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
