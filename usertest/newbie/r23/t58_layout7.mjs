// 1024×700 で通知が出ている間のステータスバー、ダーク、長い通知
import { launch, fresh, T, makeLog, shot, sel, gotoCol, sleep } from './lib.mjs'
const { log, save } = makeLog('t58_layout7')
const allErr = []
for (const scheme of ['light', 'dark']) {
  const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 }, colorScheme: scheme })
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await gotoCol(page, '型式')
  // 長い通知を出す
  await page.keyboard.press('Control+Enter'); await sleep(200); if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
  await page.keyboard.press('Alt+KeyX'); await sleep(150)
  const m = await page.evaluate(() => { const st = document.querySelector('[data-testid="status"]'); const items = [...st.querySelectorAll('.hints > *')].map((e) => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.left), Math.round(r.right)] }); const t = st.querySelector('.toast'); const tr = t?.getBoundingClientRect(); return { vw: innerWidth, toast: t ? [t.textContent.slice(0, 80), Math.round(tr.left), Math.round(tr.right), t.scrollWidth > t.clientWidth] : null, items, bodyScroll: document.documentElement.scrollWidth } })
  log(scheme, JSON.stringify(m))
  await shot(page, `t58_1024_${scheme}_toast`)
  // ? ヘルプ と パレット
  await page.keyboard.press('?'); await sleep(150); await shot(page, `t58_1024_${scheme}_help`)
  const hm = await page.evaluate(() => { const d = document.querySelector('.overlay .dialog'); const r = d?.getBoundingClientRect(); return d ? { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, scrollable: d.scrollHeight > d.clientHeight || !!d.querySelector('.body') && d.querySelector('.body').scrollHeight > d.querySelector('.body').clientHeight } : null })
  log(scheme, 'help', JSON.stringify(hm))
  await page.keyboard.press('Escape'); await sleep(80)
  allErr.push(...errors); await browser.close()
}
save(allErr)
