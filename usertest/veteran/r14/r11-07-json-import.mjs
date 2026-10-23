// ラウンド10: 新しい形の壊れた JSON を「JSON を読み込む」で読ませる（UI から）。確認の文・トースト・画面が壊れないか・続くキー（↓ Enter 編集 Alt+4 F8 Ctrl+Z）
import { open, reset, sleep, logger, state, snap } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const page = env.page; const log = logger(`07-json-import-${port}.json`)
const panelText = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 260) ?? null)
const toast = () => page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 220) ?? '')
async function pal(q) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await sleep(80); await page.keyboard.press('Enter'); await sleep(150) }
async function importJson(text) {
  await pal('JSON を読み込む')
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus(); const t0 = Date.now(); await page.keyboard.press('Control+Enter'); await sleep(200)
  const confirm = await panelText(); const t1 = await toast()
  let second = null
  if (confirm && !confirm.startsWith('JSON を読み込む')) { await page.keyboard.press('2'); await sleep(60); if (await panelText()) { await page.keyboard.press('Enter'); await sleep(300) } second = await panelText(); if (second) { await page.keyboard.press('Escape'); await sleep(100) } }
  const ms = Date.now() - t0
  for (let i = 0; i < 2 && (await panelText()); i++) { await page.keyboard.press('Escape'); await sleep(80) }
  return { confirm: confirm?.slice(0, 200), toast1: t1, second: second?.slice(0, 160), toast: await toast(), ms }
}
await reset(env)
const base = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
const W = (f) => { const w = structuredClone(base); const p = w.projects.find((x) => x.id === w.currentProjectId); f(w, p); return JSON.stringify(w) }
const SHAPES = {
  '行 ID の重複（R010 が 2 行）': () => W((w, p) => { const r = structuredClone(p.rows[9]); r.name = '重複した R010'; p.rows.splice(20, 0, r) }),
  '行 ID が無い・数値・空': () => W((w, p) => { delete p.rows[0].id; p.rows[1].id = 12345; p.rows[2].id = '' }),
  '必要数が文字列 "12"・負・"Infinity"・1e309': () => W((w, p) => { p.rows[3].qtyNeeded = '12'; p.rows[4].qtyNeeded = -5; p.rows[5].qtyNeeded = 'Infinity'; p.rows[6].qtyNeeded = 1e308 * 10 }),
  '日付が 2026-02-30・"明日"・数値': () => W((w, p) => { p.rows[7].needDateFixed = '2026-02-30'; p.rows[8].needDateFixed = '明日'; p.rows[9].needDateFixed = 20261201; p.dueDate = 'xx' }),
  '部品名が 1MB の文字列': () => W((w, p) => { p.rows[0].name = 'あ'.repeat(1_000_000) }),
  '__proto__・constructor のキー': () => W((w, p) => { p.rows[0] = JSON.parse(JSON.stringify(p.rows[0]).replace('{', '{"__proto__":{"polluted":1},"constructor":{"prototype":{"x":1}},')) }),
  'currentProjectId が存在しない': () => W((w) => { w.currentProjectId = 'NOPE' }),
  'projects が空配列': () => W((w) => { w.projects = [] }),
  '見積が無い行・無い商社を指す': () => W((w, p) => { p.quotes = [...(p.quotes ?? []), { rowId: 'R999', supplierId: 'S999', unitPrice: 1, leadDays: 1, moq: 1 }, { rowId: 'R010', supplierId: 'ZZZ', unitPrice: 'abc', leadDays: null }] }),
  '指摘が無い行を指す・status が未知': () => W((w, p) => { p.issues = [...(p.issues ?? []), { id: 'I999', rowId: 'R999', kind: '仕様確認', status: 'weird', body: 'x', by: { name: 'x', role: 'design' }, at: 'x', thread: [] }] }),
  'status が未知の値（"exploded"）': () => W((w, p) => { p.rows[10].status = 'exploded' }),
  '先頭に BOM（U+FEFF）': () => '﻿' + W(() => {}),
  '末尾のカンマ（JSON の誤り）': () => W(() => {}).replace(/}$/, ',}'),
  'コメント付き（// …）': () => '// 書き出し 2026-10-23\n' + W(() => {}),
  '2 つの JSON を連結': () => W(() => {}) + W(() => {}),
  'rows が 5,000 行（同じ ID 無し）': () => W((w, p) => { const b = p.rows.filter((r) => r.status === 'draft' || r.status === 'quoting'); for (let i = 0; p.rows.length < 5000; i++) { const r = structuredClone(b[i % b.length]); r.id = 'Y' + String(i).padStart(5, '0'); p.rows.push(r) } }),
  'schemaVersion が未来（99）': () => W((w) => { w.version = 99; w.schemaVersion = 99 }),
  '配列そのもの（[]）': () => '[]',
  'null': () => 'null',
  'CSV を貼った': () => '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,2',
}
const only = process.env.ONLY
for (const [name, mk] of Object.entries(SHAPES)) {
  if (only && !name.includes(only)) continue
  await reset(env)
  const rec = { name }
  try {
    const text = mk(); rec.size = text.length
    Object.assign(rec, await importJson(text))
    await page.locator('.gridwrap').focus()
    const keys = ['ArrowDown', 'ArrowDown', 'Enter', 'Escape', 'Alt+4', 'F8', 'Alt+1', 'Control+z', 'Control+g']
    const slow = []
    for (const k of keys) { const t = Date.now(); await page.keyboard.press(k); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); const d = Date.now() - t; if (d > 300) slow.push(`${k}:${d}`) }
    await page.keyboard.press('Escape')
    rec.slow = slow
    rec.alive = await page.evaluate(() => !!document.querySelector('[data-testid="grid"]') && !document.body.innerText.includes('問題が起きました'))
    rec.after = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null'); const p = w?.projects.find((x) => x.id === w.currentProjectId); return w ? { projects: w.projects.length, cur: w.currentProjectId, rows: p?.rows.length, dupIds: p ? p.rows.length - new Set(p.rows.map((r) => r.id)).size : null, polluted: ({}).polluted ?? null } : null })
    rec.cursor = (await state(page)).cursor
  } catch (e) { rec.error = String(e).slice(0, 200) }
  rec.errs = [...new Set(env.errs.splice(0))].slice(0, 4)
  log(rec)
}
log.save(); await env.browser.close()
