// ラウンド15: 2 つのタブと「公開を戻す」Ctrl+Z / Ctrl+Y（V14-11 の修正のあと）。同じ人が 2 タブで、片方が公開・もう片方が戻す・公開し直す
import { open, reset, gotoCell, sleep, logger, state, installToastLog, takeToasts } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`103-twotab-undo-${port}${process.env.RUN ?? ''}.json`)
const info = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); const last = p.submissions.at(-1); return `R010=${r.name}${r.working ? '/作業中:' + (r.working.name ?? JSON.stringify(r.working)) : ''} revs=${p.submissions.map((s) => s.rev).join(',')} 最後のRevのR010=${last.snapshot?.R010?.name ?? '-'}` })
const toast = async (pg) => (await state(pg)).toast.slice(0, 150)
async function tabB() { const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await sleep(300); return B }
const ed = async (pg, v) => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(150) }
const pub = async (pg) => { await pg.bringToFront(); await pg.keyboard.press('Control+Enter'); await sleep(250); for (let i = 0; i < 2; i++) { if ((await state(pg)).panel) { await pg.keyboard.press('1'); await pg.keyboard.press('Enter'); await sleep(300) } } }
const key = async (pg, k) => { await pg.bringToFront(); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press(k); await sleep(400) }
async function S(name, expect, fn) {
  await reset(env); const seq = []; const B = await tabB(); const step = async (who, label, f) => { const pg = who === 'A' ? A : B; await f(pg); seq.push(`${who} ${label}→${await info(pg)} «${await toast(pg)}»`) }
  await fn(step, B); log({ name, expect, seq }); await B.close()
}
await S('T1 A: E1 → 公開 → B: リロード → B: Ctrl+Z → A: Ctrl+Z', 'A の 2 回目の戻しは何もしない（二重に戻さない）', async (step) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await step('A', '公開', pub); await step('B', 'リロード', async (pg) => { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(300) })
  await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('B', 'Ctrl+Y', (pg) => key(pg, 'Control+y'))
})
await S('T2 A: E1 → 公開 → A: Ctrl+Z（公開を戻す）→ B: 公開（Rev.3）→ A: Ctrl+Y', 'A の Ctrl+Y は止める（B が公開し直した）か、Rev と行の値がそろう', async (step) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await step('A', '公開', pub); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
  await step('B', '公開', pub); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('T3 A: E1 → 公開 → B: E2 → B: 公開 → A: Ctrl+Z', 'A は B の公開を戻さない（自分の Rev.2 だけ。B の値に戻す／止める）', async (step) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await step('A', '公開', pub); await step('B', 'E2', (pg) => ed(pg, 'E2')); await step('B', '公開', pub)
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
