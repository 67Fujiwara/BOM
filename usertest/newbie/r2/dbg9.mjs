import { launch, fresh, T, shot } from './lib.mjs'
for (const vp of [{ width: 1024, height: 700 }, { width: 1440, height: 900 }]) {
  const { browser, page, errors } = await launch({ viewport: vp })
  await fresh(page)
  await page.keyboard.press('?')
  const info = async () => page.evaluate(() => { const els = [...document.querySelectorAll('.overlay *')].filter((e) => e.scrollHeight > e.clientHeight + 5 && getComputedStyle(e).overflowY !== 'visible'); return els.map((e) => ({ cls: e.className, sh: e.scrollHeight, ch: e.clientHeight, st: e.scrollTop })) })
  console.log(vp.width, 'scrollers', JSON.stringify(await info()))
  for (const k of ['ArrowDown', 'PageDown', 'End', ' ']) { await page.keyboard.press(k); }
  console.log(vp.width, 'after keys', JSON.stringify(await info()), 'panel', await T.panel(page))
  const last = await page.evaluate(() => { const h = document.querySelector('[data-testid=help]'); const all = [...h.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim()); const l = all.at(-1); const r = l.getBoundingClientRect(); return { text: l.textContent, top: Math.round(r.top), vh: innerHeight } })
  console.log(vp.width, 'last help item', JSON.stringify(last))
  await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.wheel(0, 3000); await page.waitForTimeout(200)
  console.log(vp.width, 'after wheel', JSON.stringify(await info()))
  await shot(page, `r2_help_${vp.width}`)
  await browser.close()
}
