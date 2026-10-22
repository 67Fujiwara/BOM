import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
async function editCell(rowId, colLabel, value, { insert = false } = {}) {
  await goto(page, rowId)
  const ok = await toCol(page, colLabel)
  if (!ok) return { err: 'col not found ' + colLabel }
  await page.keyboard.press('Enter')
  if ((await mode(page)) !== '編集') return { err: 'not edit: ' + (await toast(page)) }
  await page.keyboard.press('Control+a')
  if (insert) await page.keyboard.insertText(value); else await page.keyboard.type(value)
  await page.keyboard.press('Enter')
  await sleep(30)
  const ws = await state(page)
  const r = ws.projects.find((x) => x.id === ws.currentProjectId).rows.find((x) => x.id === rowId)
  const cellTxt = await page.locator(`[data-row-id="${rowId}"] td[data-col]`).evaluateAll((tds, label) => tds.map((t) => t.textContent), colLabel)
  return { row: { ...r, flags: r.flags, working: r.working }, mode: await mode(page), toast: await toast(page), header: await page.getByTestId('money').textContent(), lamps: await page.getByTestId('lamps').textContent() }
}
await fresh(page, 'design')
// show hidden columns needed
await page.keyboard.press('c')
// toggle packQty, needDateFixed on
const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
for (const want of ['入数', '必要日(固定)', '発注数']) { const i = cols.findIndex((c) => c.startsWith(want)); if (i >= 0) { await page.keyboard.press('Control+ArrowUp'); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space') } }
await page.keyboard.press('Escape')
// qty boundary on draft row R076 (no publish) and published R020
for (const [rid, v] of [['R076', '0'], ['R076', '-1'], ['R076', '1e9'], ['R076', '1.5'], ['R076', '１２'], ['R076', ' '], ['R076', '1,000'], ['R076', 'abc'], ['R076', '999999999999999999999'], ['R020', '0'], ['R020', '2.5']]) {
  const r = await editCell(rid, '必要数', v)
  out.push({ case: `qty ${rid} ${JSON.stringify(v)}`, qty: r.row?.qtyNeeded, working: r.row?.working, toast: r.toast, header: r.header, lamps: r.lamps, err: r.err })
  console.log(out.at(-1))
}
// model boundary
const long = 'X'.repeat(500)
for (const [rid, v, ins] of [['R076', long, false], ['R076', 'A\tB', true], ['R076', 'A\nB', true], ['R076', '🔥MY4N😀', false], ['R076', '<script>alert(1)</script>', false], ['R076', '<img src=x onerror="document.title=\'xss\'">', false], ['R076', '"><b>bold</b>', false], ['R020', '　ＭＹ４Ｎ　', false]]) {
  const r = await editCell(rid, '型式', v, { insert: ins })
  const shown = await page.locator(`[data-row-id="${rid}"] td.model`).first().innerHTML()
  out.push({ case: `model ${rid} ${JSON.stringify(v).slice(0, 40)}`, model: (r.row?.working?.model ?? r.row?.model)?.slice(0, 60), len: (r.row?.working?.model ?? r.row?.model)?.length, html: shown.slice(0, 120), title: await page.title(), toast: r.toast, err: r.err })
  console.log(out.at(-1))
}
await shot(page, '03-model-xss')
// packQty 0 / needDateFixed weird dates
for (const [rid, col, v] of [['R076', '入数', '0'], ['R076', '入数', '-3'], ['R076', '必要日(固定)', '2026/13/45'], ['R076', '必要日(固定)', '未定'], ['R076', '必要日(固定)', '昨日'], ['R076', '必要日(固定)', '2026-2-30'], ['R076', '必要日(固定)', '13/45'], ['R076', '単位', 'ぱ'], ['R076', '単位', 'p'], ['R076', '単位', 'zzz'], ['R076', '調達区分', '指'], ['R076', '代替可否', '不'], ['R076', '回路記号', 'K1'], ['R076', '分類', '制御']]) {
  const r = await editCell(rid, col, v)
  const key = { '入数': 'packQty', '必要日(固定)': 'needDateFixed', '単位': 'unit', '調達区分': 'procurement', '代替可否': 'altPolicy', '回路記号': 'ref', '分類': 'category' }[col]
  out.push({ case: `${col} ${rid} ${JSON.stringify(v)}`, value: r.row?.working?.[key] ?? r.row?.[key], needDateCell: await page.locator(`[data-row-id="${rid}"] td[data-col="needDate"]`).textContent().catch(() => null), toast: r.toast, err: r.err })
  console.log(out.at(-1))
}
await shot(page, '03-dates')
// purchasing: unit price / lead / moq / validUntil in view 9
await setRole(page, 'purchasing')
await page.keyboard.press('9')
const sup = await page.locator('table.grid th').allTextContents()
console.log('view9 cols', sup.slice(0, 30))
async function editSup(rid, label, v) {
  await goto(page, rid)
  await page.keyboard.press('Home')
  let found = false
  for (let i = 0; i < 60; i++) { if ((await cursor(page)).endsWith(label)) { found = true; break }; await page.keyboard.press('ArrowRight') }
  if (!found) return { err: 'no col' }
  await page.keyboard.press('Enter')
  if ((await mode(page)) !== '編集') return { err: 'not edit: ' + (await toast(page)) }
  await page.keyboard.press('Control+a')
  await page.keyboard.type(v)
  await page.keyboard.press('Enter')
  await sleep(30)
  const ws = await state(page)
  const p = ws.projects.find((x) => x.id === ws.currentProjectId)
  const q = p.quotes.find((x) => x.rowId === rid && x.supplierId === 'S1' && !x.stale)
  const r = p.rows.find((x) => x.id === rid)
  return { q: q && { unitPrice: q.unitPrice, leadDays: q.leadDays, moq: q.moq, validUntil: q.validUntil, stock: q.stock }, status: r.status, flags: r.flags, toast: await toast(page), header: await page.getByTestId('money').textContent() }
}
// rows in view 9: quoted rows. R020 quoted.
for (const [rid, label, v] of [['R020', '単価', '1,200'], ['R020', '単価', '¥1200'], ['R020', '単価', '１２００'], ['R020', '単価', '1200円'], ['R020', '単価', '-5'], ['R020', '単価', '0'], ['R020', '単価', '1e9'], ['R020', '単価', '12.345'], ['R020', '納期', '即納'], ['R020', '納期', '-1'], ['R020', '納期', '辞退'], ['R020', '納期', '99999'], ['R020', 'MOQ', '1000000000000'], ['R020', 'MOQ', '0'], ['R020', '在庫', 'ざ'], ['R020', '在庫', 'x'], ['R020', '有効期限', '2026/13/45'], ['R020', '有効期限', '昨日'], ['R020', '有効期限', '2020-01-01']]) {
  const r = await editSup(rid, label, v)
  out.push({ case: `sup ${rid} ${label} ${JSON.stringify(v)}`, ...r })
  console.log(out.at(-1))
}
// cursor must be on first supplier col: check which supplier col we edited
await shot(page, '03-view9')
// orderQty purchasing in view 9
for (const [rid, v] of [['R020', '0'], ['R020', '-1'], ['R020', '1e9']]) {
  await goto(page, rid); const ok = await toCol(page, '発注数')
  if (!ok) { out.push({ case: 'orderQty col missing in view 9' }); break }
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
  const ws = await state(page); const r = ws.projects[0].rows.find((x) => x.id === rid)
  out.push({ case: `orderQty ${rid} ${v}`, orderQty: r.orderQty, toast: await toast(page), header: await page.getByTestId('money').textContent() })
  console.log(out.at(-1))
}
save('03-boundary.json', out)
dumpErrors(errors, 'boundary')
await browser.close()
