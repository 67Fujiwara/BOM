// ラウンド17: 公開を戻す Ctrl+Z の修正（V16-09/15: 別のタブの作業中の値があれば戻さない・それより前の操作も外す）の境目。
// 別のタブで入れて戻した作業中の値、公開と同じ値を打ち直した、自分のタブの作業中、断ったあとのリロード、別の行・別の項目
import { open, reset, gotoCell, sleep, logger, state } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`123-undo-publish5-${port}${process.env.RUN ?? ''}.json`)
const info = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const f = (id) => { const r = p.rows.find((x) => x.id === id); return `${id}=${r.name}${r.working ? '/作業中:' + (r.working.name ?? JSON.stringify(r.working).slice(0, 30)) : ''}` }; const last = p.submissions.at(-1); const wj = (id) => JSON.stringify(p.rows.find((x) => x.id === id).working ?? null); return `${f('R010')} ${f('R020')} ${f('R030')} w010=${wj('R010')} w020=${wj('R020')} revs=${p.submissions.map((s) => s.rev).join(',')} 最後のRev[R010=${last?.snapshot?.R010?.name ?? '-'} R020=${last?.snapshot?.R020?.name ?? '-'}]` })
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

const typ = async (pg, id, col, v) => { await pg.bringToFront(); await gotoCell(pg, 1, id, col); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(150) }
await S('C1 A: R010 E1 → 公開 → B: R010 E2 → B: Ctrl+Z（B の作業中を戻す）→ A: Ctrl+Z', 'B が自分で戻したので A の公開は戻せる', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C2 A: R010 E1 → 公開 → B: R010 E2 → B: R010 を E1 と打ち直す（公開と同じ値）→ A: Ctrl+Z', '作業中の値は公開と同じ（変わっていない）ので A の公開は戻せる、または止めるなら理由が合う', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2')); await step('B', 'R010 E1（打ち直し）', (pg) => ed(pg, 'R010', 'E1'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C3 A: R010 E1 → 公開 → B: R010 を E1 と打つ（同じ値）→ A: Ctrl+Z', '何も変えていないので A の公開は戻せる', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E1（同じ値）', (pg) => ed(pg, 'R010', 'E1'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C4 A: R020 A1・R010 E1 → 公開 → B: R010 E2 → A: Ctrl+Z（断る）→ A: リロード → A: Ctrl+Z → B: Ctrl+Z（E2 を戻す）→ A: Ctrl+Z → A: Ctrl+Z', '断ったあとはリロードしても同じ（断った公開・前の操作は戻さない）', async (step) => {
  await step('A', 'R020 A1', (pg) => ed(pg, 'R020', 'A1')); await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 E2', (pg) => ed(pg, 'R010', 'E2'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'リロード', reload); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
  await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C5 A: R010 E1 → 公開 → A: R010 のメーカ M1（自分の作業中）→ A: Ctrl+Z → A: Ctrl+Z', '自分のメーカの変更を戻し、そのあと公開を戻す', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('A', 'R010 メーカ M1', (pg) => typ(pg, 'R010', 'メーカ', 'M1'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C6 A: R010 E1 → 公開 → B: R010 のメーカ M2（公開と別の項目）→ A: Ctrl+Z', 'B の作業中のメーカ M2 を残して、部品名だけ戻す（または止める）', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R010 メーカ M2', (pg) => typ(pg, 'R010', 'メーカ', 'M2'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('B', '表示', async () => {})
})
await S('C7 A: R010 E1 → 公開 → A: R010 E3（自分の作業中・Ctrl+Z しない）→ A: Ctrl+Z ×3', '1 回目は E3 を戻す、2 回目は公開を戻す', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('A', 'R010 E3', (pg) => ed(pg, 'R010', 'E3'))
  for (let i = 0; i < 3; i++) await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
await S('C8 A: R010 E1 → 公開 → B: R030 X2（公開に入っていない行）→ A: Ctrl+Z', '別の行の作業中は関係ない（戻せる）', async (step) => {
  await step('A', 'R010 E1', (pg) => ed(pg, 'R010', 'E1')); await step('A', '公開', (pg) => pub(pg))
  await step('B', 'R030 X2', (pg) => ed(pg, 'R030', 'X2'))
  await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
