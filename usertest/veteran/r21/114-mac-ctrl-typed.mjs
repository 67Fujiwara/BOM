// ラウンド16: macOS で、セルに打っている途中に欄の中の Emacs 風キー（Control+E 行末・Control+K 行末まで消す・Control+F 1 字進む・Control+P 前の行）を押したとき、
// 打っていた文字が確定されるか・失われるか（PLAT=mac で navigator.platform を MacIntel に。PLAT=linux は Ctrl+英字として比べる）
import { open, reset, gotoCell, sleep, logger, state } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const PLAT = process.env.PLAT ?? 'mac'
const env = await open(port); const pg = env.page; const log = logger(`114-mac-ctrl-typed-${PLAT}-${port}${process.env.RUN ?? ''}.json`)
if (PLAT === 'mac') await env.context.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }) })
const r010 = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return r.working?.name ?? r.name })
for (const k of ['Control+e', 'Control+k', 'Control+f', 'Control+p', 'Control+a', 'Control+d', 'Control+h']) {
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.press('F2'); await sleep(100); await pg.keyboard.press('End'); await pg.keyboard.type('XYZ'); await sleep(100)
  await pg.keyboard.press(k); await sleep(300)
  const s = await state(pg)
  const ed = await pg.evaluate(() => document.querySelector('[data-testid="cell-editor"]')?.value ?? null)
  await pg.keyboard.press('Escape'); await sleep(150); await pg.keyboard.press('Escape'); await sleep(150)
  log({ name: `${PLAT} 編集中に「端子台エンドカバーXYZ」→ ${k}`, panel: s.panel, mode: s.mode, editor: ed, toast: s.toast.slice(0, 120), savedAfterEsc: await r010() })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
