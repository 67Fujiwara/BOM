import { launch, fresh, T, shot } from './lib.mjs'
const { browser, page } = await launch({ viewport: { width: 1024, height: 700 } })
for (const r of ['design', 'purchasing', 'pm']) { await fresh(page, r); const h = await page.getByTestId('header').evaluate((el) => [...el.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return `${e.textContent.trim()}${s.display === 'none' || b.width === 0 ? '[hidden]' : b.right > innerWidth ? '[clipped]' : ''}` }).join(' | ')); console.log(r, h); await shot(page, `dbg_hdr_${r}`) }
await browser.close()
