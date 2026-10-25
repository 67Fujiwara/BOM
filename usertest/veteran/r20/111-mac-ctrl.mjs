// ラウンド16: macOS の Control+英字（欄の中の Emacs 風の操作: Control+D 後ろの 1 字を消す・A 行頭・E 行末・K 行末まで消す・F/B 1 字進む/戻る・N/P 次/前の行・H 1 字消す）。
// ラウンド15 の修正（macOS では Control+D を止めない）の境目と、ほかの Control+英字。navigator.platform を MacIntel にして（PLAT=mac）、Linux（PLAT=linux）と比べる。
// ヘッドレスの Chromium（Linux）は Emacs 風の操作をしないので、見るのは「アプリが既定動作を止めたか（defaultPrevented）」「アプリが何かを実行したか（モード・パネル・値・知らせ）」
import { open, reset, gotoCell, sleep, logger, state } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const PLAT = process.env.PLAT ?? 'mac'
const env = await open(port); const pg = env.page; const log = logger(`111-mac-ctrl-${PLAT}-${port}${process.env.RUN ?? ''}.json`)
if (PLAT === 'mac') await env.context.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }) })
const hook = () => pg.evaluate(() => { window.__kd = []; window.addEventListener('keydown', (e) => { if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return; window.__kd.push({ k: (e.ctrlKey ? 'Ctrl+' : '') + (e.metaKey ? 'Meta+' : '') + e.key, prevented: e.defaultPrevented, tgt: e.target.dataset?.testid ?? e.target.className ?? e.target.tagName }) }) })
const look = () => pg.evaluate(() => { const a = document.activeElement; return { plat: navigator.platform, focus: a?.dataset?.testid ?? (a?.className || a?.tagName), value: 'value' in (a ?? {}) ? a.value : null, mode: document.querySelector('[data-testid="mode"]')?.textContent ?? '', panel: document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null, kd: window.__kd, toast: ((document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '').slice(0, 120), r010: (() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return r.working?.name ?? r.name })() } })
const TARGETS = {
  editor: async () => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.press('F2'); await sleep(100); await pg.keyboard.press('End') },
  palette: async () => { await pg.keyboard.press('Control+k'); await sleep(150); await pg.keyboard.type('abcdef'); await pg.keyboard.press('Home'); await pg.keyboard.press('ArrowRight') },
  filter: async () => { await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+f'); await sleep(150); await pg.keyboard.type('abcdef'); await pg.keyboard.press('Home'); await pg.keyboard.press('ArrowRight') },
  grid: async () => { await gotoCell(pg, 1, 'R010', '部品名') },
}
const KEYS = (process.env.KEYS ?? 'Control+d,Meta+d,Control+Shift+d,Control+k,Control+e,Control+a,Control+f,Control+b,Control+n,Control+p,Control+h,Control+t').split(',')
for (const [tname, setup] of Object.entries(TARGETS)) {
  for (const k of KEYS) {
    if (tname === 'grid' && !/[dD]$/.test(k)) continue
    await reset(env); await setup(); await sleep(100)
    const before = await look()
    await hook(); await pg.keyboard.press(k); await sleep(250)
    const after = await look()
    log({ name: `${PLAT} ${tname} ${k}`, before: { focus: before.focus, value: before.value, mode: before.mode, panel: before.panel }, after })
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
