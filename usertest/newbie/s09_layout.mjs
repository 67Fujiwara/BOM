// S09: 画面幅 1024×700 / 1920×1080 / ダークモードのレイアウト（約8人）
import { launch, fresh, T, makeLog, shot, sel } from './lib.mjs'
const { log, save } = makeLog('s09_layout')
const allErrors = []
const measure = async (page, tag) => {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight
    const q = (s) => document.querySelector(s)
    const box = (s) => { const el = q(s); if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) } }
    const header = q('.header')
    const kids = [...header.children].map((c) => ({ cls: c.className, text: c.textContent.slice(0, 20), right: Math.round(c.getBoundingClientRect().right), left: Math.round(c.getBoundingClientRect().left) }))
    const clipped = kids.filter((k) => k.right > vw || k.left < 0)
    const status = q('.status')
    const sk = [...status.children].map((c) => ({ cls: c.className, right: Math.round(c.getBoundingClientRect().right) }))
    return { vw, vh, headerScroll: header.scrollWidth, headerClient: header.clientWidth, clipped, statusScroll: status.scrollWidth, statusClient: status.clientWidth, statusOverflow: sk.filter((s) => s.right > vw), docScrollW: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, grid: box('.gridwrap'), side: box('.side'), roleBtn: box('.role'), cmdBtn: box('.header .btn'), dialog: box('.dialog') }
  })
  log(tag, JSON.stringify(m))
  return m
}
for (const [w, h, scheme] of [[1024, 700, 'light'], [1920, 1080, 'light'], [1024, 700, 'dark'], [1280, 720, 'light'], [800, 600, 'light']]) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h }, colorScheme: scheme })
  try {
    await fresh(page)
    if (scheme === 'dark') { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダーク'); await page.keyboard.press('Enter') }
    const tag = `${w}x${h}-${scheme}`
    await measure(page, tag + ' grid')
    await shot(page, `s09_${tag}_grid`)
    await sel(page, 'R022'); await page.keyboard.press('Space')
    await measure(page, tag + ' detail')
    await shot(page, `s09_${tag}_detail`)
    await page.keyboard.press('?')
    await measure(page, tag + ' help')
    await shot(page, `s09_${tag}_help`)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter')
    await measure(page, tag + ' settings')
    await shot(page, `s09_${tag}_settings`)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
    for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
    await shot(page, `s09_${tag}_wizard`)
    await page.keyboard.press('Escape'); for (let i = 0; i < 8; i++) await page.keyboard.press('Escape')
    await page.keyboard.press('9')
    await page.locator('.role button', { hasText: '購買' }).click()
    await shot(page, `s09_${tag}_view9`)
    // ステータスバーの長いトースト
    await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+Enter')
    await measure(page, tag + ' toast')
    await shot(page, `s09_${tag}_toast`)
    // 横スクロールして右端の列にカーソル → 見えるか
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('End')
    const vis = await page.evaluate(() => { const td = document.querySelector('td.cursor'); const g = document.querySelector('.gridwrap'); if (!td) return null; const a = td.getBoundingClientRect(), b = g.getBoundingClientRect(); return { tdL: Math.round(a.left), tdR: Math.round(a.right), gL: Math.round(b.left), gR: Math.round(b.right) } })
    log(tag, 'End col cursor visible:', JSON.stringify(vis))
    await shot(page, `s09_${tag}_end`)
  } catch (e) { log('EXC', tag, String(e)) }
  allErrors.push(...errors.map((e) => ({ ...e, at: `${w}x${h}-${scheme}` })))
  await browser.close()
}
log('console/page errors:', allErrors)
save(allErrors)
