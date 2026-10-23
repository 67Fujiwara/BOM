// ラウンド16: タブを複製（同じタブから開いたタブは sessionStorage の Ctrl+Z の履歴を写し持つ）したときの Ctrl+Z / Ctrl+Y。
// ベテランは「タブを複製」して 2 つの画面で同じ案件を見る。同じ公開・同じ編集を 2 つのタブで戻せるか（二重に戻す・作業中を二重に積む）
import { open, reset, gotoCell, sleep, logger, state } from './lib16.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`113-dup-tab-${port}${process.env.RUN ?? ''}.json`)
const info = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); const h = JSON.parse(sessionStorage.getItem('bom-pro.history') ?? '{}'); const n = (m) => Object.values(m ?? {}).reduce((a, v) => a + v.length, 0); return `R010=${r.name}${r.working ? '/作業中:' + (r.working.name ?? JSON.stringify(r.working)) : ''} revs=${p.submissions.map((s) => s.rev).join(',')} 履歴 undo${n(h.undo)}/redo${n(h.redo)}` })
const toast = async (pg) => (await state(pg)).toast.slice(0, 170)
const ed = async (pg, v) => { await pg.bringToFront(); await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(150) }
const pub = async (pg) => { await pg.bringToFront(); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press('Control+Enter'); await sleep(250); for (let i = 0; i < 2; i++) { if ((await state(pg)).panel) { await pg.keyboard.press('1'); await pg.keyboard.press('Enter'); await sleep(300) } } }
const key = async (pg, k) => { await pg.bringToFront(); await pg.locator('.gridwrap').focus().catch(() => {}); await pg.keyboard.press(k); await sleep(400) }
async function dup() { await sleep(500); const [B] = await Promise.all([env.context.waitForEvent('page'), A.evaluate(() => window.open(location.href))]); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await sleep(300); return B }
async function S(name, expect, fn) {
  await reset(env); const seq = []; let B = null; const step = async (who, label, f) => { const pg = who === 'A' ? A : B; await f(pg); seq.push(`${who} ${label}→${await info(pg)} «${await toast(pg)}»`) }
  await fn(step, async () => { B = await dup(); seq.push(`B 複製→${await info(B)}`) }); log({ name, expect, seq }); await B?.close()
}
await S('D1 A: R010 E1 → 公開 → タブを複製(B) → B: Ctrl+Z → A: Ctrl+Z → A: Ctrl+Y → B: Ctrl+Y', '同じ公開を 2 回戻さない（2 つ目は止める）', async (step, mkB) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await step('A', '公開', pub); await mkB()
  await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('B', 'Ctrl+Y', (pg) => key(pg, 'Control+y'))
})
await S('D2 A: R010 E1（公開しない）→ タブを複製(B) → B: Ctrl+Z → A: Ctrl+Z → B: Ctrl+Y → A: Ctrl+Y', '2 つ目の Ctrl+Z・Ctrl+Y は止める', async (step, mkB) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await mkB()
  await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('B', 'Ctrl+Y', (pg) => key(pg, 'Control+y')); await step('A', 'Ctrl+Y', (pg) => key(pg, 'Control+y'))
})
await S('D3 A: R010 E1 → 公開(Rev.2) → R010 E2 → タブを複製(B) → B: 公開(Rev.3) → A: Ctrl+Z ×2', 'A は B の Rev.3 を戻さない', async (step, mkB) => {
  await step('A', 'E1', (pg) => ed(pg, 'E1')); await step('A', '公開', pub); await step('A', 'E2', (pg) => ed(pg, 'E2')); await mkB()
  await step('B', '公開', pub); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('A', 'Ctrl+Z', (pg) => key(pg, 'Control+z')); await step('B', 'Ctrl+Z', (pg) => key(pg, 'Control+z'))
})
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
