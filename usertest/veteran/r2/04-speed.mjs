// 高速連打と反応時間（80 行）
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, toastNow } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 500)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))

async function latency(keys, n = 30, setup) {
  return page.evaluate(async ({ keys, n }) => {
    const res = []
    for (let i = 0; i < n; i++) {
      const k = keys[i % keys.length]
      const t = performance.now()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, ctrlKey: !!k.ctrl, shiftKey: !!k.shift, bubbles: true, cancelable: true }))
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
      res.push(performance.now() - t)
    }
    res.sort((a, b) => a - b)
    return { median: +res[Math.floor(n / 2)].toFixed(1), p90: +res[Math.floor(n * 0.9)].toFixed(1), max: +res.at(-1).toFixed(1) }
  }, { keys, n })
}

await fresh(page)
// j×200
{
  const n = errors.length
  await page.keyboard.press('ArrowDown')
  const t0 = Date.now()
  for (let i = 0; i < 200; i++) await page.keyboard.press('j')
  log('j200', { ms: Date.now() - t0, cursor: await cursor(page), cursorVisible: await page.locator('td.cursor').isVisible(), errors: perr(n) })
  const t1 = Date.now()
  for (let i = 0; i < 200; i++) await page.keyboard.press('k')
  log('k200', { ms: Date.now() - t1, cursor: await cursor(page), cursorInView: await page.evaluate(() => { const c = document.querySelector('td.cursor') ?? document.querySelector('tr.group.sel'); const w = document.querySelector('.gridwrap'); if (!c) return 'no cursor el'; const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom }) })
}
// Enter→Ctrl+A→文字→Enter ×50
{
  const n = errors.length
  await goto(page, 'R001'); await toCol(page, '部品名')
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('品' + i); await page.keyboard.press('Enter') }
  const p = await proj(page)
  const vis = p.rows.filter((r) => r.status !== 'cancelled' && r.status !== 'replaced')
  const ok = p.rows.slice(0, 50).filter((r, i) => (r.working?.name ?? r.name) === '品' + i).length
  log('enter50', { ms: Date.now() - t0, ok, cursor: await cursor(page), mode: await mode(page), errors: perr(n) })
}
// 上書き入力（Excel 流）: 型式セルで M+番号+Enter ×50
{
  await fresh(page)
  await goto(page, 'R001'); await toCol(page, '型式')
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) { await page.keyboard.type('MX' + i); await page.keyboard.press('Enter') }
  const p = await proj(page)
  const ok = p.rows.slice(0, 50).filter((r, i) => (r.working?.model ?? r.model) === 'MX' + i).length
  log('overwrite50', { ms: Date.now() - t0, ok, sample: p.rows.slice(0, 3).map((r) => r.working?.model ?? r.model) })
}
// 遅延なしの連続入力（キーを溜めて送る）: Enter, 文字, Enter を 30 行
{
  await fresh(page)
  await goto(page, 'R001'); await toCol(page, '備考')
  const t0 = Date.now()
  const seq = []
  for (let i = 0; i < 30; i++) seq.push(page.keyboard.press('Enter'), page.keyboard.type('N' + i), page.keyboard.press('Enter'))
  await Promise.all(seq)
  await sleep(300)
  const p = await proj(page)
  const ok = p.rows.slice(0, 30).filter((r, i) => (r.working?.note ?? r.note).endsWith('N' + i)).length
  log('burst30', { ms: Date.now() - t0, ok, sample: p.rows.slice(0, 4).map((r) => r.working?.note ?? r.note), mode: await mode(page) })
}
// 1〜9 ×100
{
  await fresh(page); await page.keyboard.press('ArrowDown')
  const t0 = Date.now()
  for (let i = 0; i < 100; i++) for (const k of '123456789') await page.keyboard.press(k)
  log('views900', { ms: Date.now() - t0, view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid), cursor: await cursor(page) })
}
// x ×50, n ×100, Space ×50
{
  await fresh(page)
  const n = errors.length
  await page.keyboard.press('4')
  let t0 = Date.now(); for (let i = 0; i < 100; i++) await page.keyboard.press('n'); const nms = Date.now() - t0
  t0 = Date.now(); for (let i = 0; i < 50; i++) await page.keyboard.press('x'); const xms = Date.now() - t0
  await page.keyboard.press('1'); await goto(page, 'R020')
  t0 = Date.now(); for (let i = 0; i < 51; i++) await page.keyboard.press('Space'); const sms = Date.now() - t0
  log('n100_x50_space51', { nms, xms, sms, detailOpen: await page.getByTestId('detail').count(), errors: perr(n) })
}
// Shift+Enter ×30 → Shift+Delete ×30
{
  await fresh(page)
  const n = errors.length
  await goto(page, 'R080')
  const t0 = Date.now()
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Shift+Enter'); await page.keyboard.type('新' + i); await page.keyboard.press('Enter') }
  const p1 = await proj(page)
  const t1 = Date.now()
  for (let i = 0; i < 30; i++) { await goto(page, 'R' + String(81 + i).padStart(3, '0')); await page.keyboard.press('Shift+Delete'); if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } }
  const p2 = await proj(page)
  log('insert30_delete30', { insMs: t1 - t0, delMs: Date.now() - t1, rowsAfterIns: p1.rows.length, rowsAfterDel: p2.rows.length, names: p1.rows.slice(80, 83).map((r) => r.name), errors: perr(n) })
}
// in-page 反応時間（80 行、spec 50ms）
{
  await fresh(page); await page.keyboard.press('ArrowDown')
  const res = {}
  res.j = await latency([{ key: 'j', code: 'KeyJ' }, { key: 'k', code: 'KeyK' }])
  res.arrowRight = await latency([{ key: 'ArrowRight', code: 'ArrowRight' }, { key: 'ArrowLeft', code: 'ArrowLeft' }])
  res.space = await latency([{ key: ' ', code: 'Space' }])
  res.view = await latency([{ key: '1', code: 'Digit1' }, { key: '4', code: 'Digit4' }, { key: '2', code: 'Digit2' }, { key: '9', code: 'Digit9' }])
  await page.keyboard.press('1'); await page.keyboard.press('ArrowDown')
  res.n = await latency([{ key: 'n', code: 'KeyN' }])
  res.paletteOpenClose = await latency([{ key: 'k', code: 'KeyK', ctrl: true }, { key: 'Escape', code: 'Escape' }])
  res.helpOpenClose = await latency([{ key: '?', code: 'Slash', shift: true }, { key: 'Escape', code: 'Escape' }])
  log('latency80', res)
}
save2('04-speed.json', out)
dumpErrors(errors, 'speed')
await browser.close()
