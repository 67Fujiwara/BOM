// ラウンド16: 公開を戻す Ctrl+Z の修正（V15-08/09/11: 別のタブが公開し直した行は戻さずに飛ばす・公開を戻したらそれより前の操作は外す・やり直しのあとの文）の境目。
// 飛ばしたあとの Ctrl+Z、別のタブの作業中の値、直前の Rev に追記、リロードをまたぐ、別の案件の操作
import { open, reset, gotoCell, sleep, logger, state } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`110-undo-publish4-${port}${process.env.RUN ?? ''}.json`)
const info = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const f = (id) => { const r = p.rows.find((x) => x.id === id); return `${id}=${r.name}${r.working ? '/作業中:' + (r.working.name ?? JSON.stringify(r.working).slice(0, 30)) : ''}` }; const last = p.submissions.at(-1); return `${f('R010')} ${f('R020')} ${f('R030')} revs=${p.submissions.map((s) => s.rev).join(',')} 最後のRev[R010=${last?.snapshot?.R010?.name ?? '-'} R020=${last?.snapshot?.R020?.name ?? '-'}]` })
const toast = async (pg) => (await state(pg)).toast.slice(0, 170)
async function tabB() { const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await sleep(300); return B }
const ed = async (pg, id, v) => { await pg.bringToFront(); await gotoCell(pg, 1, id, '部品名'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(150) }
const pub = async (pg, choice = '1') => { await pg.bringToFront(); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press('Control+Enter'); await sleep(250); for (let i = 0; i < 2; i++) { if ((await state(pg)).panel) { await pg.keyboard.press(choice); await pg.keyboard.press('Enter'); await sleep(300) } } }
const key = async (pg, k) => { await pg.bringToFront(); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press(k); await sleep(400) }
const reload = async (pg) => { await pg.bringToFront(); await sleep(300); await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300) }
async function S(name, expect, fn) {
  await reset(env); const seq = []; const B = await tabB(); const step = async (who, label, f) => { const pg = who === 'A' ? A : B; await f(pg); seq.push(`${who} ${label}→${await info(pg)} «${await toast(pg)}»`) }
  await fn(step, B); log({ name, expect, seq }); await B.close()
}
await S('B1 A: R020 A1・R010 E1 → 公開(Rev.2) → B: R010 E2 → 公開(Rev.3) → A: Ctrl+Z ×4', '1 回目は「飛ばしました」。そのあとも Rev.2 に含まれる R020 A1・R010 E1 を戻さない（公開した値の裏で作業中・公開値を変えない）', async (step) => {
  await step('A', 'R020 A1', (pg) => ed(pg, 'R020', 'A1')); await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', '公開', (pg) => pub(pg))
  for (let i = 0; i < 4; i++) await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('B2 A: R010 E1 → 公開(Rev.2) → B: R010 E2（作業中・公開しない）→ A: Ctrl+Z', 'B の作業中 E2 を黙って上書きしない（止めるか E2 を残す）', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('B', '表示', async () => {})
})
await S('B3 A: R010 E1 → 公開(Rev.2) → B: R010 E2 → 公開（直前の Rev に追記）→ A: Ctrl+Z', 'A は B が追記した E2 を戻さない（止める）', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', '公開（追記）', (pg) => pub(pg, '2'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('B4 A: R010 E1 → 公開 → R030 X1（公開しない）→ B: R010 E2 → 公開 → A: Ctrl+Z ×3', 'R030 を戻す → 公開は飛ばす → R010 E1 は戻さない', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg)); await step('A', 'R030 X1', (pg) => ed(pg, 'R030', 'X1'))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', '公開', (pg) => pub(pg))
  for (let i = 0; i < 3; i++) await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('B5 1 タブ: R010 E1 → 公開 → リロード → Ctrl+Z → Ctrl+Y → リロード → Ctrl+Z → Ctrl+Z', '2 回目の Ctrl+Z の文は「公開を戻す」、3 回目は止まる', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg)); await step('A', 'リロード', reload)
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('A', 'リロード', reload)
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y'))
})
await S('B6 A: R010 E1 → 公開(Rev.2) → B: リロード → B: R010 E2 → 公開(Rev.3) → A: リロード → A: Ctrl+Z', 'リロードのあとも「飛ばしました」', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg)); await step('B', 'リロード', reload)
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', '公開', (pg) => pub(pg)); await step('A', 'リロード', reload)
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('B7 A: R010 E1 → 公開(Rev.2) → A: Ctrl+Z（公開を戻す）→ B: R010 E2 → 公開(Rev.3) → A: Ctrl+Y → A: Ctrl+Z', 'Ctrl+Y は止める。そのあとの Ctrl+Z は B の Rev.3 を戻さない', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg)); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', '公開', (pg) => pub(pg))
  await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
