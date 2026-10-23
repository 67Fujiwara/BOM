import { launch, fresh, makeLog, shot } from './lib.mjs'
const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 } })
const { log, save } = makeLog('dbg5_contrast')
await fresh(page); await page.keyboard.press('1'); await page.waitForTimeout(200)
const res = await page.evaluate(() => {
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
  const bgOf = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; el = el.parentElement } return 'rgb(255,255,255)' }
  const out = {}
  for (const el of document.querySelectorAll('td, span, div')) {
    if (el.children.length) continue
    const t = el.textContent.trim(); if (!/^(見積済|見積中|選定済|正式依頼中|提出済|下書き|納期NG|作業中●|要再確認)/.test(t)) continue
    const fg = getComputedStyle(el).color, bg = bgOf(el); const a = lum(fg), b = lum(bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const k = t.slice(0, 8) + ' ' + fg + ' on ' + bg; out[k] = Math.round(cr * 100) / 100
  }
  const n7 = document.querySelector('[data-testid="view-7"]'); const cnt = n7 ? [...n7.querySelectorAll('*')].map((e) => [e.textContent, getComputedStyle(e).color]) : null
  return { out, cnt }
})
log(JSON.stringify(res, null, 1))
save(errors); await browser.close()
