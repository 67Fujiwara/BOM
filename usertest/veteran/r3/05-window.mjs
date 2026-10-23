// 表示範囲だけ描く表（ウィンドウ化）: 300 行で PageDown・Ctrl+↓・詳細・コンパクト・リサイズ・並び替え・絞り込み後のカーソル、空白、コピー
import { launch, fresh, goto, toColKey, cursor, mode, sleep, dumpErrors, save, proj, closeAll, palette, toastNow, storeState, cursorVisible, renderedRows, shot, wizardCreate, bom300 } from './lib.mjs'
const { browser, context, page, errors } = await launch()
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 900)) }
const blank = () => page.evaluate(() => {
  // 表の見える範囲に、行が描かれていない帯（spacer だけ）がないか
  const w = document.querySelector('.gridwrap'); const wr = w.getBoundingClientRect()
  const th = w.querySelector('thead')?.getBoundingClientRect().height ?? 0
  let covered = 0
  for (const tr of w.querySelectorAll('tbody > tr:not(.spacer)')) { const r = tr.getBoundingClientRect(); const top = Math.max(r.top, wr.top + th), bot = Math.min(r.bottom, wr.bottom); if (bot > top) covered += bot - top }
  const tableBottom = w.querySelector('table').getBoundingClientRect().bottom
  const need = Math.min(wr.bottom, tableBottom) - (wr.top + th)
  return { covered: Math.round(covered), need: Math.round(need), gap: Math.round(need - covered) }
})
await fresh(page)
const c = await wizardCreate(page, 'P-300', bom300())
await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
log('create', c)
// 1. PageDown を最後まで: 毎回カーソルが見えるか・何行進むか
{
  const res = []
  for (let i = 0; i < 18; i++) { await page.keyboard.press('PageDown'); await sleep(20); const v = await cursorVisible(page); res.push({ cur: (await cursor(page)).split(' ')[0], inView: v.inView, gap: (await blank()).gap }) }
  log('pageDown', { steps: res.map((r) => r.cur).join(','), notVisible: res.filter((r) => !r.inView).length, blankGaps: res.filter((r) => r.gap > 2).length })
  const up = []
  for (let i = 0; i < 18; i++) { await page.keyboard.press('PageUp'); await sleep(20); const v = await cursorVisible(page); up.push({ cur: (await cursor(page)).split(' ')[0], inView: v.inView }) }
  log('pageUp', { steps: up.map((r) => r.cur).join(','), notVisible: up.filter((r) => !r.inView).length })
}
// 2. Ctrl+↓ / Ctrl+↑ / End / Home（横）
{
  await page.keyboard.press('Control+ArrowDown'); await sleep(30)
  const a = { cur: await cursor(page), vis: await cursorVisible(page), gap: (await blank()).gap }
  await page.keyboard.press('End'); await sleep(30)
  const b = { cur: await cursor(page), vis: await cursorVisible(page) }
  await page.keyboard.press('Control+ArrowUp'); await sleep(30)
  const c2 = { cur: await cursor(page), vis: await cursorVisible(page) }
  await page.keyboard.press('Home')
  log('ctrlArrows', { bottom: a, end: b, top: c2 })
}
// 3. 一番下の行で Space（詳細）: 詳細が全部見えるか
{
  await page.keyboard.press('Control+ArrowDown'); await page.keyboard.press('Space'); await sleep(150)
  const d = await page.evaluate(() => { const w = document.querySelector('.gridwrap'); const wr = w.getBoundingClientRect(); const det = w.querySelector('tr.detail'); if (!det) return null; const r = det.getBoundingClientRect(); return { detTop: Math.round(r.top), detBottom: Math.round(r.bottom), wBottom: Math.round(wr.bottom), fully: r.bottom <= wr.bottom + 1, h: Math.round(r.height) } })
  await shot(page, '05-detail-bottom')
  // 詳細を開いたまま k / j
  await page.keyboard.press('k'); await sleep(30); const vk = await cursorVisible(page)
  await page.keyboard.press('j'); await sleep(30); const vj = await cursorVisible(page)
  await page.keyboard.press('Space')
  log('detailAtBottom', { detail: d, afterK: vk.inView, afterJ: vj.inView })
}
// 3b. 詳細を 40 行開いてから j で下りる（高さの見積もり違い）
{
  await page.keyboard.press('Control+ArrowUp')
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Space'); await page.keyboard.press('j') }
  await sleep(100)
  const notVis = []
  await page.keyboard.press('Control+ArrowUp')
  for (let i = 0; i < 45; i++) { await page.keyboard.press('j'); await sleep(5); const v = await cursorVisible(page); if (!v.inView) notVis.push((await cursor(page)).split(' ')[0] + JSON.stringify(v).slice(0, 60)) }
  await page.keyboard.press('Control+ArrowDown'); await sleep(50)
  const vb = await cursorVisible(page)
  await page.keyboard.press('Control+ArrowUp'); await sleep(50)
  const vt = await cursorVisible(page)
  log('manyDetails', { notVisibleDuringJ: notVis.length, sample: notVis.slice(0, 3), bottomVisible: vb.inView, topVisible: vt.inView, gap: (await blank()).gap })
  await shot(page, '05-many-details')
  // 全部閉じる
  await page.keyboard.press('Escape')
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
}
// 4. コンパクト表示で PageDown / Ctrl+↓
{
  await palette(page, 'コンパクト表示切替'); await sleep(80)
  await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
  const res = []
  for (let i = 0; i < 16; i++) { await page.keyboard.press('PageDown'); await sleep(15); const v = await cursorVisible(page); res.push(v.inView) }
  await page.keyboard.press('Control+ArrowDown'); await sleep(30)
  const vb = await cursorVisible(page)
  const g = await blank()
  log('compact', { notVisible: res.filter((x) => !x).length, bottom: vb.inView, gap: g.gap, rendered: await renderedRows(page) })
  await shot(page, '05-compact-bottom')
  await palette(page, 'コンパクト表示切替'); await sleep(50)
}
// 5. リサイズ（狭く・広く・150% 相当）で空白・カーソル
{
  const res = {}
  await goto(page, 'R150')
  for (const [w, h] of [[1440, 900], [853, 480], [1280, 720], [1920, 1200], [1024, 1400], [683, 384]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(150)
    res[`${w}x${h}`] = { cur: (await cursor(page)).split(' ')[0], vis: (await cursorVisible(page)).inView, gap: (await blank()).gap, rendered: await renderedRows(page) }
    await page.keyboard.press('j'); await sleep(30)
    res[`${w}x${h}`].afterJ = (await cursorVisible(page)).inView
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await sleep(100)
  log('resize', res)
}
// 6. 並び替え・絞り込み・解除のあとカーソルが見えるか（カーソル行は変わらない操作）
{
  const res = {}
  const chk = async (tag) => { await sleep(80); const v = await cursorVisible(page); res[tag] = { cur: (await cursor(page)).split(' ')[0], rendered: v.rendered, inView: v.inView ?? false } }
  await page.keyboard.press('1'); await goto(page, 'R150'); await toColKey(page, 'model'); await chk('start')
  await page.keyboard.press('Shift+S'); await chk('sortDesc')
  await page.keyboard.press('s'); await chk('sortAsc')
  await page.keyboard.press('s'); await chk('sortOff')
  await goto(page, 'R150'); await toColKey(page, 'maker'); await page.keyboard.press('f'); await chk('filterOn')
  await page.keyboard.press('f'); await chk('filterOff')
  await goto(page, 'R220'); await page.keyboard.press('/'); await page.keyboard.type('部品22'); await page.keyboard.press('Enter'); await chk('textFilter')
  await page.keyboard.press('Escape'); await chk('textFilterEsc')
  await page.keyboard.press('/'); await page.keyboard.press('Escape'); await chk('slashEsc')
  // Ctrl+Z で並び替えの前に戻す（並びは Undo の対象外のはず）・ビュー切替
  await goto(page, 'R250'); await page.keyboard.press('4'); await page.keyboard.press('1'); await chk('view4then1')
  // 分類を折りたたむ → 開く
  await goto(page, 'R250'); await page.keyboard.press(']'); await page.keyboard.press('['); await chk('catPrevNext')
  log('cursorAfterReorder', res)
}
// 7. マウスで別の場所にスクロールしてから Enter / 文字（キーボード派でもスクロールバーは触る）
{
  await goto(page, 'R010'); await toColKey(page, 'name')
  await page.evaluate(() => { document.querySelector('.gridwrap').scrollTop = 6000 }); await sleep(150)
  await page.keyboard.press('Enter'); await sleep(80)
  const a = { mode: await mode(page), editorInDom: await page.getByTestId('cell-editor').count(), vis: await cursorVisible(page), active: await page.evaluate(() => document.activeElement?.className) }
  await page.keyboard.type('マウス後'); await page.keyboard.press('Enter'); await sleep(50)
  const r = (await proj(page)).rows.find((x) => x.id === 'R010')
  log('scrollAwayThenEdit', { ...a, saved: r.working?.name ?? r.name })
}
// 8. 書式つきコピー・Excel は描いていない行も含むか
{
  await page.keyboard.press('1')
  await page.keyboard.press('Control+Shift+C'); await sleep(200)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  log('copyAll', { lines: clip.split('\n').filter(Boolean).length, toast: (await toastNow(page)).slice(0, 80) })
}
// 9. 速い j 連打（300 回）
{
  await page.keyboard.press('Control+ArrowUp')
  const t0 = Date.now(); for (let i = 0; i < 299; i++) await page.keyboard.press('j'); const ms = Date.now() - t0
  log('j299', { ms, perKey: +(ms / 299).toFixed(1), cur: await cursor(page), vis: (await cursorVisible(page)).inView, gap: (await blank()).gap })
}
save('05-window.json', out)
dumpErrors(errors, '05')
await browser.close()
