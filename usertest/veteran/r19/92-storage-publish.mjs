// ラウンド14: 保存できないとき（BREAK: workspace の保存だけ失敗）・空きが少ないときの、公開・公開の Ctrl+Z / Ctrl+Y（ラウンド13 の修正: Ctrl+Y の側だけに積む）
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`92-storage-publish-${port}${process.env.RUN ?? ""}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const stored = (p = pg) => p.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return { rows: p.rows.length, r010: r.working?.name ?? r.name, r011: (p.rows.find((x) => x.id === 'R011').working?.name ?? p.rows.find((x) => x.id === 'R011').name), hidden: p.rows.filter((r) => r.hidden).map((r) => r.id).join(','), user: w.user.role } }, LSK)
const fillTo = (free, p = pg) => p.evaluate((free) => { localStorage.removeItem('other-app-cache'); let lo = 0, hi = 6_000_000; while (hi - lo > 64) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } } const n = Math.max(0, lo - free); localStorage.setItem('other-app-cache', 'y'.repeat(n)); return { cap: lo, filled: n } }, free)
const freeUp = (p = pg) => p.evaluate(() => localStorage.removeItem('other-app-cache'))
const breakSave = (p = pg) => p.evaluate((k) => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (key, v) { if (this === window.localStorage && key === k && !window.__fixed) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, key, v) } }, LSK)
const fixSave = (p = pg) => p.evaluate(() => { window.__fixed = true })
const toastInfo = (p = pg) => p.evaluate(() => { const t = document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'); return t ? `${t.className.match(/err|ok|info/g)?.join('/') ?? ''}|${t.textContent.slice(0, 150)}` : '' })
async function key(t, p = pg) {
  if (t.startsWith('T:')) return p.keyboard.type(t.slice(2))
  if (t.startsWith('G:')) { await p.keyboard.press('Control+g'); await p.getByTestId('prompt-text').fill(t.slice(2)); return p.keyboard.press('Enter') }
  if (t.startsWith('PAL:')) { await p.keyboard.press('Control+k'); await p.getByTestId('palette-input').fill(t.slice(4)); await sleep(100); return p.keyboard.press('Enter') }
  if (t === 'FREE') return freeUp(p)
  if (t.startsWith('FILE:')) { await p.getByTestId('wizard-file').setInputFiles('/home/user/BOM/usertest/veteran/r19/dl/' + t.slice(5)); return sleep(2500) }
  if (t === 'FIX') return fixSave(p)
  if (t === 'FULL') return fillTo(0, p)
  if (t.startsWith('NEAR:')) return fillTo(Number(t.slice(5)), p)
  if (t === 'RELOAD') { await p.reload(); await p.waitForSelector('[data-testid="grid"]'); await p.locator('.gridwrap').focus(); return sleep(300) }
  if (t === 'BREAK') return breakSave(p)
  return p.keyboard.press(t)
}
const snapAll = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { projects: w.projects.length, cur: w.currentProjectId, rows: p.rows.length, issues: p.issues.length, revs: p.submissions.length, r010: p.rows.find((x) => x.id === 'R010')?.working?.name ?? p.rows.find((x) => x.id === 'R010')?.name, r004: p.rows.find((x) => x.id === 'R004')?.status, role: w.user.role } }, LSK)
async function run(name, { role = 'design', free = 2000, toks, expect }) {
  await reset(env, { role }); await gotoCell(pg, 1, 'R010', '部品名')
  await fillTo(free)
  await installToastLog(pg); await takeToasts(pg)
  const before = await snapAll()
  const seq = []
  for (const t of toks) { await key(t); await sleep(250); const s = await state(pg); seq.push(`${t}→${s.cursor}/${s.mode}${s.panel ? '{' + s.panel + '}' : ''} «${(await toastInfo()).slice(0, 140)}»`) }
  const screen = await pg.evaluate(() => ({ rows: document.querySelectorAll('[data-testid="grid"] [data-row-id]').length, title: document.title }))
  const stored0 = await snapAll()
  await key('RELOAD')
  const afterReload = await snapAll()
  log({ name, expect, before, seq, toasts: (await takeToasts(pg)).slice(-6), storedBeforeReload: stored0, afterReload })
  await freeUp()
}
const PUB = ['Control+Enter', '2', 'Enter']
await run('S1 E1 → 公開 → 保存できなくする → Ctrl+Z → Ctrl+Y → 保存できるように戻す → Ctrl+S', { free: 300000, toks: ['T:E1', 'Enter', ...PUB, 'BREAK', 'Control+z', 'Control+y', 'FIX', 'Control+s'], expect: '保存できていないと知らせる。Ctrl+Y 後に保存すると公開済の値' })
await run('S2 E1 → 公開 → 保存できなくする → Ctrl+Z → 保存できるように戻す → Ctrl+S → リロード → Ctrl+Y', { free: 300000, toks: ['T:E1', 'Enter', ...PUB, 'BREAK', 'Control+z', 'FIX', 'Control+s', 'RELOAD', 'Control+y'], expect: 'リロード後も Ctrl+Y で公開済に戻せる' })
await run('S3 空き 0 → E1 → 公開', { free: 0, toks: ['T:E1', 'Enter', ...PUB], expect: '保存できていないと知らせる' })
await run('S4 保存できなくする → 公開のダイアログ → 保存できるように戻す → 2 Enter', { free: 300000, toks: ['T:E1', 'Enter', 'BREAK', 'Control+Enter', 'FIX', '2', 'Enter'], expect: '公開して保存' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
