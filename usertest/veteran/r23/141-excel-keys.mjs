// ラウンド19: ラウンド18 の修正（Excel の癖のキー Ctrl+X・Ctrl+;・Ctrl+R・Ctrl+-・Alt+Enter は「ありません」と知らせる。既定動作を止める）の境目。
// ベテランが使うブラウザのキーと重なる: Ctrl+R / Cmd+R（再読み込み）、Ctrl+- / Cmd+-（縮小。Ctrl+= の拡大・Ctrl+0 は止めない？）、
// 編集中・絞り込み・パレットの欄の中の Ctrl+X（文字の切り取り）。PLAT=mac で navigator.platform を MacIntel に（Cmd は metaKey）。
// 見るのは defaultPrevented（ヘッドレスではブラウザの再読み込み・拡大縮小は起きないので、止めたかどうかで判定）、値・クリップボード・知らせ
import { open, reset, gotoCell, sleep, logger, state } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const PLAT = process.env.PLAT ?? 'linux'
const env = await open(port); const pg = env.page; const log = logger(`141-excel-keys-${PLAT}-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
if (PLAT === 'mac') await env.context.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }) })
const hook = () => pg.evaluate(() => { window.__kd = []; window.addEventListener('keydown', (e) => { if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return; window.__kd.push({ k: (e.ctrlKey ? 'Ctrl+' : '') + (e.metaKey ? 'Meta+' : '') + (e.altKey ? 'Alt+' : '') + e.key, prevented: e.defaultPrevented, tgt: e.target.dataset?.testid ?? e.target.className ?? e.target.tagName }) }) })
const look = () => pg.evaluate(() => { const a = document.activeElement; return { focus: a?.dataset?.testid ?? (a?.className || a?.tagName), value: a && 'value' in a ? a.value : null, sel: a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null, kd: window.__kd ?? [] } })
const clip = () => pg.evaluate(() => navigator.clipboard.readText().catch(() => '(読めない)'))
const TARGETS = {
  grid: async () => { await gotoCell(pg, 1, 'R010', '部品名') },
  // 編集中: 値の後ろ 3 文字を選んで（Shift+← ×3）
  editor: async () => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.press('F2'); await sleep(100); await pg.keyboard.press('End'); for (let i = 0; i < 3; i++) await pg.keyboard.press('Shift+ArrowLeft') },
  typed: async () => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type('ABC DEF'); await sleep(80); for (let i = 0; i < 2; i++) await pg.keyboard.press('Shift+ArrowLeft') },
  filter: async () => { await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+f'); await sleep(150); await pg.keyboard.type('abcdef'); await pg.keyboard.press('End'); for (let i = 0; i < 3; i++) await pg.keyboard.press('Shift+ArrowLeft') },
  palette: async () => { await pg.keyboard.press('Control+k'); await sleep(150); await pg.keyboard.type('abcdef'); await pg.keyboard.press('End'); for (let i = 0; i < 3; i++) await pg.keyboard.press('Shift+ArrowLeft') },
}
const M = PLAT === 'mac' ? 'Meta' : 'Control'
const KEYS = (process.env.KEYS ?? `${M}+x,${M}+r,${M}+Minus,${M}+Equal,${M}+0,Control+;,Alt+Enter,F5`).split(',')
for (const [tname, setup] of Object.entries(TARGETS)) {
  for (const k of KEYS) {
    if (k === 'F5' && tname !== 'grid') continue
    await reset(env)
    await pg.evaluate(() => navigator.clipboard.writeText('(前のクリップボード)')).catch(() => {})
    await setup(); await sleep(100)
    const before = await look(); const s0 = await state(pg)
    await hook()
    let reloaded = false
    pg.once('load', () => { reloaded = true })
    await pg.keyboard.press(k).catch((e) => { reloaded = 'err:' + e.message.slice(0, 60) })
    await sleep(300)
    const after = await look().catch(() => ({ kd: [] })); const s1 = await state(pg).catch(() => ({}))
    log({ name: `${PLAT} ${tname} ${k}`, before: { focus: before.focus, value: before.value, sel: before.sel, mode: s0.mode }, after: { focus: after.focus, value: after.value, sel: after.sel, mode: s1.mode, panel: s1.panel, toast: s1.toast, kd: after.kd }, clipboard: await clip().catch(() => ''), reloaded })
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save()
await env.browser.close()
