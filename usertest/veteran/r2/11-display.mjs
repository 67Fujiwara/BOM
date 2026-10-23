// ダーク / コンパクト / 1280×720 / ズーム 150%（CSS ピクセル 853×480）
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, palette, paletteExact, closeAll, toastNow } from './lib.mjs'
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const look = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight
  const cur = document.querySelector('td.cursor')
  const cs = cur ? getComputedStyle(cur) : null
  const nb = cur?.nextElementSibling ? getComputedStyle(cur.nextElementSibling) : null
  const body = getComputedStyle(document.body)
  const vis = (sel) => { const e = document.querySelector(sel); if (!e) return 'none'; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5 ? 'ok' : `out(${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})` }
  const rowH = document.querySelector('[data-testid="row"]')?.getBoundingClientRect().height
  const gw = document.querySelector('.gridwrap').getBoundingClientRect()
  return {
    vw, vh, theme: document.documentElement.dataset.theme ?? '', density: document.documentElement.dataset.density ?? '', bodyBg: body.backgroundColor, bodyFg: body.color,
    cursor: cs ? { outline: cs.outlineStyle + ' ' + cs.outlineColor + ' ' + cs.outlineWidth, boxShadow: cs.boxShadow.slice(0, 60), bg: cs.backgroundColor, nbBg: nb?.backgroundColor } : null,
    rowH, gridVisibleH: Math.round(gw.height), rowsVisible: rowH ? Math.floor(gw.height / rowH) : null,
    header: vis('[data-testid="header"]'), status: vis('[data-testid="status"]'), mode: vis('[data-testid="mode"]'), cursorLabel: vis('[data-testid="cursor"]'), side: vis('[data-testid="side"]'), roles: ['design', 'purchasing', 'pm'].map((r) => vis(`[data-testid="role-${r}"]`)).join('/'), palBtn: vis('[data-testid="open-palette"]'),
    hScroll: document.documentElement.scrollWidth > vw, vScroll: document.documentElement.scrollHeight > vh,
  }
})
const panelFits = (page) => page.evaluate(() => { const d = document.querySelector('[data-testid^="panel-"] .dialog') ?? document.querySelector('[data-testid^="panel-"] > *'); if (!d) return 'none'; const r = d.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 ? 'fits' : `out(${Math.round(r.top)},${Math.round(r.bottom)}/${innerHeight}, ${Math.round(r.left)},${Math.round(r.right)}/${innerWidth})` })
for (const [w, h, tag] of [[1440, 900, '1440'], [1280, 720, '1280x720'], [853, 480, 'zoom150']]) {
  const { browser, page, errors } = await launch({ viewport: { width: w, height: h } })
  await fresh(page)
  await goto(page, 'R020')
  log({ tag, mode: 'light', ...(await look(page)) })
  await shot2(page, `11-${tag}-light`)
  await paletteExact(page, 'ダークモード切替', 'ダーク'); await sleep(50); await goto(page, 'R020')
  log({ tag, mode: 'dark', ...(await look(page)) })
  await shot2(page, `11-${tag}-dark`)
  await paletteExact(page, 'コンパクト表示切替', 'コンパクト'); await sleep(50); await goto(page, 'R020')
  log({ tag, mode: 'dark+compact', ...(await look(page)) })
  await shot2(page, `11-${tag}-dark-compact`)
  // パネルが収まるか
  const pf = {}
  for (const [name, open] of [['palette', () => page.keyboard.press('Control+k')], ['help', () => page.keyboard.press('?')], ['columns', () => page.keyboard.press('c')], ['detail', () => page.keyboard.press('Space')], ['wizard', () => palette(page, '新しいBOM')], ['settings', () => palette(page, '案件設定')], ['adopt', async () => { await goto(page, 'R020'); await page.keyboard.press('Shift+A') }], ['issue', async () => { await setRole(page, 'purchasing'); await goto(page, 'R030'); await page.keyboard.press('Shift+I') }]]) {
    await open(); await sleep(60)
    pf[name] = name === 'detail' ? await page.evaluate(() => { const d = document.querySelector('[data-testid="detail"]'); if (!d) return 'none'; const r = d.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scrollable: d.scrollHeight > d.clientHeight } }) : await panelFits(page)
    if (name === 'detail') await page.keyboard.press('Space'); else await closeAll(page)
    if (name === 'issue') await setRole(page, 'design')
  }
  log({ tag, panels: pf })
  // テーマの持続（リロード後）・コンパクトの持続
  await page.reload(); await page.waitForSelector('[data-testid="grid"]')
  log({ tag, afterReload: await page.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? '', density: document.documentElement.dataset.density ?? '' })) })
  dumpErrors(errors, tag)
  await browser.close()
}
// 実ズーム: deviceScaleFactor 1.5 で 1280 幅（物理）。CSS 幅 853
{
  const { browser, page, errors } = await launch({ viewport: { width: 853, height: 480 }, dsf: 1.5 })
  await fresh(page); await goto(page, 'R020'); await page.keyboard.press('Space'); await sleep(80)
  log({ tag: 'dsf1.5', ...(await look(page)) })
  await shot2(page, '11-dsf15-detail')
  await browser.close()
}
save2('11-display.json', out)
