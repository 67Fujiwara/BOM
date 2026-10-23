// 小さな確認: Alt+↓ の後の Ctrl+Z / PageDown の幅と見えている行数 / ブラウザの検索で描いていない行が見つかるか / ] の動き
import { launch, fresh, goto, toColKey, cursor, sleep, dumpErrors, save, proj, closeAll, toastNow, wizardCreate, bom300, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 700)) }
// 1) 編集 → Alt+↓ → Ctrl+Z
{
  await fresh(page)
  await goto(page, 'R030'); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('直前の編集'); await page.keyboard.press('Enter')
  await goto(page, 'R045'); await page.keyboard.press('Alt+ArrowDown'); await sleep(40)
  const orderAfterMove = (await proj(page)).rows.slice(43, 47).map((r) => r.id)
  const moveToast = await toastNow(page)
  await page.keyboard.press('Control+z'); await sleep(40)
  const p = await proj(page)
  const r30 = p.rows.find((r) => r.id === 'R030')
  log('1 move then undo', { moveToast: moveToast.slice(0, 60), orderAfterMove, undoToast: (await toastNow(page)).slice(0, 60), orderAfterUndo: p.rows.slice(43, 47).map((r) => r.id), R030: r30.working?.name ?? r30.name })
}
// 2) PageDown の幅と、見えている行数（いくつかの画面サイズ）
{
  await fresh(page)
  await wizardCreate(page, 'P-PG', bom300())
  const res = {}
  for (const [w, h] of [[1440, 900], [1280, 720], [853, 480], [1920, 1200]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(100)
    await page.keyboard.press('1'); await goto(page, 'R010')
    const visible = await page.evaluate(() => { const wr = document.querySelector('.gridwrap').getBoundingClientRect(); const th = document.querySelector('.gridwrap thead').getBoundingClientRect().height; return [...document.querySelectorAll('.gridwrap tr.row')].filter((t) => { const r = t.getBoundingClientRect(); return r.top >= wr.top + th - 1 && r.bottom <= wr.bottom + 1 }).length })
    await page.keyboard.press('PageDown'); const c = (await cursor(page)).split(' ')[0]
    res[`${w}x${h}`] = { fullyVisibleRows: visible, pageDownFromR010: c }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  log('2 pageDown step', res)
  // 3) ブラウザの検索（Ctrl+F 相当）で、画面外の行が見つかるか
  await page.keyboard.press('Control+ArrowUp')
  const found = await page.evaluate(() => ({ near: window.find('部品5'), far: window.find('MDL-0250') }))
  log('3 browser find', found)
}
// 4) 分類見出しが無い（交互）とき ] は？
{
  await fresh(page)
  await wizardCreate(page, 'P-INT', bom300(30, true))
  await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
  await page.keyboard.press(']'); await sleep(30)
  log('4 ] without headers', { cursor: await cursor(page), toast: (await toastNow(page)).slice(0, 80) })
}
save('12-misc.json', out)
dumpErrors(errors, '12')
await browser.close()
