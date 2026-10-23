// 境界値: 数量・単価・MOQ・日付・500 文字・改行・絵文字・<script>
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, toastNow } from './lib.mjs'
const { browser, context, page, errors } = await launch()
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1500)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
async function put(id, colLabel, v, getter) {
  await goto(page, id); await toCol(page, colLabel); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a')
  await page.keyboard.insertText(v)
  await page.keyboard.press('Enter'); await sleep(30)
  const m = await mode(page); const err = await page.getByTestId('edit-error').textContent({ timeout: 300 }).catch(() => null)
  if (m === '編集') await page.keyboard.press('Escape')
  const r = await row(page, id)
  if (process.env.DBG) console.log('put', id, colLabel, v.slice(0, 20), m)
  return { v: v.length > 40 ? v.slice(0, 20) + `…(${v.length})` : v, stored: getter(r), rejected: m === '編集', err: err?.slice(0, 60) }
}
console.log('launched'); await fresh(page); console.log('fresh ok')
const n0 = errors.length
const qty = []
for (const v of ['0', '-1', '1.5', '0.001', '1000000000', '1000000001', '9'.repeat(20), '1/2', '3個', '３ｍ', 'NaN', 'Infinity', '0x10', '1_000']) qty.push(await put('R030', '必要数', v, (r) => r.working?.qtyNeeded ?? r.qtyNeeded))
log('qtyNeeded', qty)
const needOff = []
// 必要日(前倒し)・必要日(固定)は既定で隠れているので列を出す
await page.keyboard.press('c')
const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
for (let i = 0; i < cols.length; i++) { if (cols[i].startsWith('○') && /必要日\(|入数|発注数/.test(cols[i])) await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Escape')
for (const v of ['-10', '400', '1.5', '７']) needOff.push(await put('R031', '必要日(前倒し)', v, (r) => r.working?.needOffset ?? r.needOffset))
for (const v of ['2026-02-30', '1999-01-01', '2101-01-01', '明日', '+30', '12/31', '20270101', '2026-11-20', '未定']) needOff.push(await put('R031', '必要日(固定)', v, (r) => r.working?.needDateFixed ?? r.needDateFixed))
for (const v of ['0', '-2', '2.5', '12']) needOff.push(await put('R031', '入数', v, (r) => r.working?.packQty ?? r.packQty))
log('needOffset/fixed/pack', needOff)
// 文字列
const long500 = 'あ'.repeat(250) + 'A'.repeat(250)
const texts = []
texts.push(await put('R032', '部品名', long500, (r) => (r.working?.name ?? r.name).length))
texts.push(await put('R032', '部品名', 'x'.repeat(5000), (r) => (r.working?.name ?? r.name).length))
texts.push(await put('R033', '部品名', '🔧リレー👍🏽‍', (r) => r.working?.name ?? r.name))
texts.push(await put('R034', '型式', '<script>alert(1)</script><img src=x onerror=alert(2)>', (r) => r.working?.model ?? r.model))
texts.push(await put('R035', '部品名', '   前後に空白   ', (r) => JSON.stringify(r.working?.name ?? r.name)))
texts.push(await put('R036', '部品名', 'ゼロ幅​スペース‮بالعربية', (r) => JSON.stringify(r.working?.name ?? r.name)))
texts.push(await put('R037', '部品名', '', (r) => JSON.stringify(r.working?.name ?? r.name)))
log('texts', { texts, dialogs: errors.filter((e) => e.type === 'dialog').length })
// 500 文字の行の高さ・横幅
const layout = await page.evaluate(() => { const td = document.querySelector('[data-row-id="R032"] td[data-col="name"]'); const tr = td.closest('tr'); const other = document.querySelector('[data-row-id="R031"]'); return { rowH: tr.getBoundingClientRect().height, normalH: other.getBoundingClientRect().height, tdW: td.getBoundingClientRect().width, overflow: getComputedStyle(td).textOverflow, title: td.title?.length } })
log('layout500', layout)
await shot2(page, '12-long')
// 改行: Shift+Enter / Alt+Enter で改行できるか（Excel は Alt+Enter）
await goto(page, 'R038'); await toCol(page, '備考'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('1行目'); await page.keyboard.press('Alt+Enter'); await page.keyboard.type('2行目'); const altEnterMode = await mode(page); await page.keyboard.press('Enter')
const r38 = await row(page, 'R038')
log('altEnter', { modeAfterAltEnter: altEnterMode, stored: JSON.stringify(r38.working?.note ?? r38.note), cursor: await cursor(page), view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid) })
// 改行入りセルを貼り付け（Excel の "a\nb" 形式）
await goto(page, 'R039'); await toCol(page, '備考')
await page.evaluate(() => navigator.clipboard.writeText('"1行目\n2行目"\n'))
await page.keyboard.press('Control+v'); await sleep(200)
const p = await proj(page)
log('pasteQuotedNewline', { r039: JSON.stringify(p.rows.find((r) => r.id === 'R039').working?.note ?? p.rows.find((r) => r.id === 'R039').note), r040: JSON.stringify(p.rows.find((r) => r.id === 'R040').working?.note ?? p.rows.find((r) => r.id === 'R040').note), toast: (await toastNow(page)).slice(0, 100) })
// 貼り付け: 数量列に文字、読み取り専用列をまたぐ、取消行をまたぐ
await goto(page, 'R041'); await page.keyboard.press('Shift+Delete'); await sleep(30)
await goto(page, 'R040'); await toCol(page, '必要数')
await page.evaluate(() => navigator.clipboard.writeText('5\tm\n abc\t個\n7\tZZZ\n8\t本'))
const ne = errors.length
await page.keyboard.press('Control+v'); await sleep(200)
const pp = await proj(page)
const g = (id) => { const r = pp.rows.find((x) => x.id === id); return `${id}(${r.status}):${r.working?.qtyNeeded ?? r.qtyNeeded}/${r.working?.unit ?? r.unit}` }
log('pasteMixed', { toast: (await toastNow(page)).slice(0, 200), rows: ['R040', 'R041', 'R042', 'R043'].map(g), errors: perr(ne) })
// 購買: 単価・納期・MOQ・有効期限の境界
await setRole(page, 'purchasing'); await page.keyboard.press('9')
const q = []
async function putQ(id, label, v) {
  await goto(page, id); await page.keyboard.press('Home'); for (let i = 0; i < 50; i++) { if ((await cursor(page)).endsWith(label)) break; await page.keyboard.press('ArrowRight') }
  const col = await cursor(page)
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(30)
  const m = await mode(page); const err = await page.getByTestId('edit-error').textContent({ timeout: 300 }).catch(() => null); if (m === '編集') await page.keyboard.press('Escape')
  const pq = (await proj(page)).quotes.find((x) => x.rowId === id && x.supplierId === 'S1' && !x.stale)
  return { col, v, stored: pq ? JSON.stringify({ p: pq.unitPrice, l: pq.leadDays, m: pq.moq, v: pq.validUntil }) : null, rejected: m === '編集', err: err?.slice(0, 50) }
}
for (const v of ['0', '0.001', '-1', '99999999999', '1e3', '１２，０００']) q.push(await putQ('R050', '単価', v))
for (const v of ['0', '-1', '辞退', '即納', '1.5', '9999', '3650', '3651']) q.push(await putQ('R050', '納期', v))
for (const v of ['0', '-3', '1.5', '1000000']) q.push(await putQ('R050', 'MOQ', v))
for (const v of ['2026-02-30', '昨日', '2026-10-01', '2030-01-01']) q.push(await putQ('R050', '有効期限', v))
log('quoteBoundary', q)
// 採用・金額: 単価 0 / MOQ 100 万で 'a'
await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R050'); await page.keyboard.press('Space'); await sleep(60)
const det = (await page.getByTestId('detail').textContent()).slice(0, 300)
await page.keyboard.press('Space'); await page.keyboard.press('a'); await sleep(40)
log('adoptExtreme', { detail: det, toast: (await toastNow(page)).slice(0, 120), money: await page.getByTestId('money').textContent() })
// 絞り込み・ジャンプで絵文字/記号
await page.keyboard.press('/'); await page.keyboard.insertText('🔧'); await page.keyboard.press('Enter'); const f1 = { rows: await page.getByTestId('row').count(), cursor: await cursor(page) }
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
await page.keyboard.press('/'); await page.keyboard.insertText('.*('); const f2 = { rows: await page.getByTestId('row').count() }; await page.keyboard.press('Escape')
await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('<script>'); await page.keyboard.press('Enter'); const g1 = await cursor(page)
log('searchSpecial', { emoji: f1, regexChars: f2, gotoScript: g1, errors: perr(n0) })
save2('12-boundary.json', out)
dumpErrors(errors, 'boundary')
await browser.close()
