// 300 行貼り付け → 全ビュー・並び替え・絞り込み・f・c・[ ]・PageUp/Down、反応時間
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, panel, closeAll, palette, toastNow } from './lib.mjs'
const { browser, context, page, errors } = await launch()
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 600)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
const cats = ['制御', '電源', '端子', '配線', '盤', '表示', 'センサ', '']
const makers = ['オムロン', '三菱電機', 'IDEC', 'パナソニック', '', 'TDKラムダ']
const lines = ['分類\t品名\t形式\tメーカー\t員数\t単位\t記号']
for (let i = 1; i <= 300; i++) lines.push([cats[i % 8], `部品${i}`, i % 17 === 0 ? '' : `MDL-${(i * 7919) % 1000}`, makers[i % 6], String((i % 13) + 1), i % 5 === 0 ? 'm' : '個', `K${i}`].join('\t'))
const tsv = lines.join('\n')

await fresh(page)
const n0 = errors.length
let t0 = Date.now()
await palette(page, '新しいBOM')
await page.getByTestId('wizard-id').fill('P-300'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('300行'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-due').fill('2027-03-31'); await page.keyboard.press('Enter')
for (let i = 0; i < 3; i++) await page.keyboard.press('Enter')
await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('Enter')
await page.keyboard.press('1')
await page.getByTestId('wizard-paste').fill(tsv)
await page.keyboard.press('Control+Enter'); await sleep(200)
const preview = await page.getByTestId('wizard-preview').textContent().catch(() => null)
await page.keyboard.press('Enter'); await sleep(500)
const p = await proj(page)
log('create', { ms: Date.now() - t0, id: p.id, rows: p.rows.length, preview: preview?.slice(0, 200), toast: (await toastNow(page)).slice(0, 120), errors: perr(n0) })
// 全ビュー
const views = {}
for (const v of '123456789') { const t = Date.now(); await page.keyboard.press(v); await sleep(10); views[v] = { ms: Date.now() - t, rows: await page.getByTestId('row').count() } }
log('views', views)
await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
// PageDown/Up, Ctrl+↓
const pg = {}
let t = Date.now(); for (let i = 0; i < 20; i++) await page.keyboard.press('PageDown'); pg.pageDown20 = { ms: Date.now() - t, cursor: await cursor(page) }
t = Date.now(); for (let i = 0; i < 20; i++) await page.keyboard.press('PageUp'); pg.pageUp20 = { ms: Date.now() - t, cursor: await cursor(page) }
t = Date.now(); await page.keyboard.press('Control+ArrowDown'); pg.ctrlDown = { ms: Date.now() - t, cursor: await cursor(page), visible: await page.locator('td.cursor').isVisible() }
t = Date.now(); for (let i = 0; i < 200; i++) await page.keyboard.press('k'); pg.k200 = { ms: Date.now() - t, cursor: await cursor(page) }
log('paging', pg)
// [ ] 分類移動
const cat = []
await page.keyboard.press('Control+ArrowUp')
for (let i = 0; i < 10; i++) { await page.keyboard.press(']'); cat.push(await cursor(page)) }
for (let i = 0; i < 3; i++) { await page.keyboard.press('['); cat.push(await cursor(page)) }
log('category', cat)
// 並び替え s / S
await goto(page, 'R150'); await toCol(page, '型式')
t = Date.now(); await page.keyboard.press('s'); const sortAsc = { ms: Date.now() - t, first: await page.locator('[data-testid="row"] td[data-col="model"]').first().textContent() }
t = Date.now(); await page.keyboard.press('Shift+S'); const sortDesc = { ms: Date.now() - t, first: await page.locator('[data-testid="row"] td[data-col="model"]').first().textContent(), cursorKept: await cursor(page) }
await page.keyboard.press('Shift+S')
// 必要数で数値の並び（文字列順になっていないか）
await toCol(page, '必要数'); await page.keyboard.press('s')
const qtys = (await page.locator('[data-testid="row"] td[data-col="qtyNeeded"]').allTextContents()).slice(0, 40)
const numericSorted = qtys.map(Number).every((x, i, a) => i === 0 || a[i - 1] <= x)
await page.keyboard.press('s')
log('sort', { sortAsc, sortDesc, qtyHead: qtys.slice(0, 15).join(','), numericSorted })
// f 絞り込み
await goto(page, 'R010'); await toCol(page, 'メーカ')
t = Date.now(); await page.keyboard.press('f'); const f1 = { ms: Date.now() - t, rows: await page.getByTestId('row').count(), toast: (await toastNow(page)).slice(0, 60) }
for (const v of '23456789') await page.keyboard.press(v)
const f2 = { rowsInView9: await page.getByTestId('row').count(), cursor: await cursor(page) }
await page.keyboard.press('1'); await page.keyboard.press('f'); const f3 = { rows: await page.getByTestId('row').count() }
// 空セルで f
await goto(page, 'R017'); await toCol(page, '型式'); await page.keyboard.press('f'); const f4 = { rows: await page.getByTestId('row').count(), toast: (await toastNow(page)).slice(0, 60) }
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
// / 絞り込み
await page.keyboard.press('/'); t = Date.now(); await page.keyboard.type('部品1'); const fl = { ms: Date.now() - t, rows: await page.getByTestId('row').count() }
await page.keyboard.press('Enter'); fl.cursor = await cursor(page)
await page.keyboard.press('Escape'); fl.after = await page.getByTestId('row').count()
log('filter', { f1, f2, f3, f4, fl })
// c 列パネル: 全部表示
await page.keyboard.press('c')
const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
for (let i = 0; i < cols.length; i++) { if (cols[i].startsWith('○')) await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Escape')
t = Date.now(); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight'); const wide = { ms40right: Date.now() - t, cursor: await cursor(page), cursorVisible: await page.evaluate(() => { const c = document.querySelector('td.cursor'); const w = document.querySelector('.gridwrap'); if (!c) return 'none'; const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 }) }
await page.keyboard.press('Home'); wide.homeVisible = await page.evaluate(() => { const c = document.querySelector('td.cursor'); const w = document.querySelector('.gridwrap'); const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); return a.left >= b.left - 1 })
log('allColumns', wide)
await shot2(page, '05-300-allcols')
// 反応時間 300 行
const lat = await page.evaluate(async () => {
  const one = async (k, code, n = 20, extra = {}) => { const res = []; for (let i = 0; i < n; i++) { const t = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true, ...extra })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); res.push(performance.now() - t) } res.sort((a, b) => a - b); return { median: +res[n >> 1].toFixed(1), max: +res.at(-1).toFixed(1) } }
  return { j: await one('j', 'KeyJ'), right: await one('ArrowRight', 'ArrowRight'), space: await one(' ', 'Space', 10), view4: await one('4', 'Digit4', 4), view1: await one('1', 'Digit1', 4), pageDown: await one('PageDown', 'PageDown', 10) }
})
log('latency300', lat)
// Ctrl+Shift+C（300 行）
t = Date.now(); await page.keyboard.press('Control+Shift+C'); await sleep(500)
log('copy300', { ms: Date.now() - t, toast: (await toastNow(page)).slice(0, 80), lines: (await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))).split('\n').length })
// Ctrl+E 社内
const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
t = Date.now(); await page.keyboard.press('Control+e'); await page.keyboard.press('Enter')
const d = await dl
log('excel300', { ms: Date.now() - t, file: d?.suggestedFilename() })
// 300 行の表に Ctrl+V で 300 行×3 列を貼る（既存行の上書き）
await page.keyboard.press('Escape')
await goto(page, 'R001'); await toCol(page, '部品名')
await page.evaluate((t) => navigator.clipboard.writeText(t), Array.from({ length: 300 }, (_, i) => `貼${i}\tPM-${i}\tメーカ${i}`).join('\n'))
t = Date.now(); await page.keyboard.press('Control+v'); await sleep(500)
const pp = await proj(page)
log('pasteOver300', { ms: Date.now() - t, toast: (await toastNow(page)).slice(0, 120), r001: pp.rows[0].name + '/' + pp.rows[0].model, r300: pp.rows[299].name + '/' + pp.rows[299].model, rows: pp.rows.length })
t = Date.now(); await page.keyboard.press('Control+z'); await sleep(200)
const pu = await proj(page)
log('undoPaste300', { ms: Date.now() - t, r001: pu.rows[0].name, r300: pu.rows[299].name, toast: (await toastNow(page)).slice(0, 80) })
// 表の末尾を超えて貼る（R290 から 30 行）
await goto(page, 'R290'); await toCol(page, '部品名')
await page.evaluate((t) => navigator.clipboard.writeText(t), Array.from({ length: 30 }, (_, i) => `末${i}`).join('\n'))
await page.keyboard.press('Control+v'); await sleep(300)
const pe = await proj(page)
log('pastePastEnd', { rows: pe.rows.length, toast: (await toastNow(page)).slice(0, 140), last: pe.rows.at(-1).name })
const ls = await page.evaluate(() => (localStorage.getItem('bom-pro.workspace.v2') ?? '').length)
log('storageSize', { bytes: ls })
save2('05-bulk300.json', out)
dumpErrors(errors, 'bulk300')
await browser.close()
