// 1024×700 とダーク: 主要画面のスクリーンショットと、はみ出し・コントラストの簡易チェック
import { launch, fresh, T, makeLog, shot, sel, palette, runPalette, setRole } from './lib.mjs'
const { log, save } = makeLog('t13_layout')
const allErr = []
for (const scheme of ['light', 'dark']) {
  const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 }, colorScheme: scheme })
  const chk = async (tag) => {
    const r = await page.evaluate(() => {
      const de = document.documentElement
      const over = [...document.querySelectorAll('.overlay .dialog, header, footer, .side, .toolbar')].map((el) => { const b = el.getBoundingClientRect(); return { c: el.className.split(' ')[0], l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), sw: el.scrollWidth, cw: el.clientWidth } }).filter((x) => x.r > innerWidth + 1 || x.b > innerHeight + 1 || x.l < -1 || x.sw > x.cw + 2)
      const bg = getComputedStyle(document.body).backgroundColor
      const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
      // 文字と背景のコントラストが 3 未満の要素（見えている文字のみ、最大 8 件）
      const low = []
      for (const el of document.querySelectorAll('body *')) {
        if (low.length >= 8) break
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
        const b = el.getBoundingClientRect(); if (!b.width || b.bottom < 0 || b.top > innerHeight) continue
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') continue
        let e = el, bgc = 'rgba(0, 0, 0, 0)'; while (e && (bgc === 'rgba(0, 0, 0, 0)' || bgc === 'transparent')) { bgc = getComputedStyle(e).backgroundColor; e = e.parentElement } if (!e && (bgc === 'rgba(0, 0, 0, 0)')) bgc = bg
        const L1 = lum(cs.color), L2 = lum(bgc); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
        if (cr < 3) low.push(`${el.tagName.toLowerCase()}.${el.className}:"${el.textContent.trim().slice(0, 20)}" ${cr.toFixed(2)} (${cs.color} on ${bgc})`)
      }
      return { scrollW: de.scrollWidth, vw: innerWidth, over, low }
    })
    log(`[${scheme} ${tag}] scrollW=${r.scrollW}/${r.vw} overflow=${JSON.stringify(r.over)} lowContrast=${JSON.stringify(r.low)}`)
    await shot(page, `t13_${scheme}_${tag}`)
  }
  await fresh(page)
  await chk('grid4')
  await page.keyboard.press('1'); await sel(page, 'R022'); await page.keyboard.press(' '); await chk('detail')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('採用'); await chk('palette'); await page.keyboard.press('Escape')
  await page.keyboard.press('?'); await chk('help'); await page.keyboard.press('Escape')
  await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter'); await page.keyboard.press('1'); await page.getByTestId('wizard-paste').fill('品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t4'); await page.keyboard.press('Control+Enter'); await chk('wizard_preview'); await page.keyboard.press('Escape')
  await setRole(page, 'purchasing'); await page.keyboard.press('6'); await chk('view6')
  await page.keyboard.press('Escape'); await setRole(page, 'pm'); await runPalette(page, '案件設定'); await chk('settings'); await page.keyboard.press('Escape')
  await page.keyboard.press('7'); await sel(page, 'R013'); await page.keyboard.press('Enter'); await chk('decision'); await page.keyboard.press('Escape')
  allErr.push(...errors)
  await browser.close()
}
save(allErr)
