// ラウンド10: 空きが少ないときの貼り付け・行の複製・Undo。知らせ（全トースト）と、リロード後に残るか
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts } from './lib18.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const page = env.page; const log = logger(`10b-storage-paste-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsN = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.length })
const fillTo = (free) => page.evaluate((free) => { localStorage.removeItem('other-app-cache'); let lo = 0, hi = 6_000_000; while (hi - lo > 2000) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } } const n = Math.max(0, lo - free); localStorage.setItem('other-app-cache', 'y'.repeat(n)); return { cap: lo, filled: n } }, free)
for (const [free, N] of [[20_000, 300], [60_000, 300], [200_000, 1000]]) {
  await reset(env); await gotoCell(page, 1, 'R080', '部品名'); const f = await fillTo(free); await installToastLog(page); await takeToasts(page)
  await page.evaluate((t) => navigator.clipboard.writeText(t), Array.from({ length: N }, (_, i) => `貼付${i}\tPM-${i}\tオムロン\t1`).join('\n'))
  await page.keyboard.press('Control+v'); await sleep(1500)
  const shown = await page.evaluate(() => document.querySelector('.statusbar, [data-testid="statusbar"]')?.textContent?.slice(0, 80))
  const toasts = await takeToasts(page); const stored = await rowsN()
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(400)
  const afterReload = await rowsN(); const shownAfter = await page.evaluate(() => document.querySelectorAll('[data-testid="grid"] tr[data-row-id]').length)
  log({ case: `空き ${free} で ${N} 行を貼り付け`, fill: f, toasts, storedRowsBeforeReload: stored, rowsAfterReload: afterReload })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
