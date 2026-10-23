// ラウンド11: JSON 読み込みの新しい形（V10-08 / V10-09 の修正の境目）。作業中の値（working）・配列・空文字・範囲外・数字の id を指す見積・指摘
import { open, reset, sleep, logger } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`29-json-new-${port}.json`)
const LSK = 'bom-pro.workspace.v2'
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 400) ?? '')
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
async function imp(name, mutate, pick) {
  await reset(env)
  const w = structuredClone(base); const p = w.projects.find((x) => x.id === w.currentProjectId); mutate(p, w)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(w))
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(250)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await pg.keyboard.press('2'); await sleep(400) }
  const t = await toast()
  const after = await pg.evaluate(([k, ids]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const o = { rows: p.rows.length, issues: p.issues.length, quotes: p.quotes.length }; for (const id of ids) { const r = p.rows.find((x) => x.id === id); o[id] = r ? { qty: r.qtyNeeded, wq: r.working?.qtyNeeded, need: r.needDateFixed, wneed: r.working?.needDateFixed, pack: r.packQty, order: r.orderQty, promised: r.promisedDate } : null } return o }, [LSK, pick ?? []])
  // 表示（1 すべてで該当行の必要数・必要日のセル）
  const shown = await pg.evaluate((ids) => ids.map((id) => { const tr = document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`); return tr ? `${id}: ${tr.textContent.replace(/\s+/g, ' ').slice(0, 140)}` : `${id}: (表示なし)` }), pick ?? [])
  log({ name, toast: t, after, shown })
}
await imp('J1 作業中の必要日(固定) 2026-02-30・作業中の必要数 -5・作業中の必要数 "Infinity"', (p) => { p.rows.find((r) => r.id === 'R010').working = { needDateFixed: '2026-02-30' }; p.rows.find((r) => r.id === 'R011').working = { qtyNeeded: -5 }; p.rows.find((r) => r.id === 'R012').working = { qtyNeeded: 'Infinity' } }, ['R010', 'R011', 'R012'])
await imp('J2 必要数 [5]・""・false・1e12・"12"', (p) => { p.rows.find((r) => r.id === 'R010').qtyNeeded = [5]; p.rows.find((r) => r.id === 'R011').qtyNeeded = ''; p.rows.find((r) => r.id === 'R012').qtyNeeded = false; p.rows.find((r) => r.id === 'R014').qtyNeeded = 1e12; p.rows.find((r) => r.id === 'R015').qtyNeeded = '12' }, ['R010', 'R011', 'R012', 'R014', 'R015'])
await imp('J3 入数 0・-5、発注数 -3、入荷予定 9999-12-31、必要日 2026-02-28T09:00', (p) => { p.rows.find((r) => r.id === 'R010').packQty = 0; p.rows.find((r) => r.id === 'R011').packQty = -5; p.rows.find((r) => r.id === 'R012').orderQty = -3; p.rows.find((r) => r.id === 'R014').promisedDate = '9999-12-31'; p.rows.find((r) => r.id === 'R015').needDateFixed = '2026-02-28T09:00' }, ['R010', 'R011', 'R012', 'R014', 'R015'])
await imp('J4 見積の単価 -100・納期 -5・単価 "abc"', (p) => { const qs = p.quotes.filter((q) => q.rowId === 'R004'); if (qs[0]) qs[0].unitPrice = -100; if (qs[1]) qs[1].leadDays = -5; if (qs[2]) qs[2].unitPrice = 'abc' }, ['R004'])
await imp('J5 数字の id の行（R010 → 10）と、その行を数字で指す見積・指摘', (p) => { const r = p.rows.find((x) => x.id === 'R004'); r.id = 4; for (const q of p.quotes) if (q.rowId === 'R004') q.rowId = 4; for (const i of p.issues) if (i.rowId === 'R004') i.rowId = 4; p.issues.push({ id: 'I-900', rowId: 4, kind: '質問', status: 'open', text: 'x', by: { name: '佐藤', role: 'purchasing' }, replies: [], field: 'name' }) }, ['4', 'R004'])
await imp('J6 id の大文字小文字（r010 と R010）・前後の空白（" R011"）', (p) => { const a = structuredClone(p.rows.find((x) => x.id === 'R010')); a.id = 'r010'; p.rows.push(a); const b = structuredClone(p.rows.find((x) => x.id === 'R011')); b.id = ' R011'; p.rows.push(b) }, ['r010', 'R010', ' R011'])
await imp('J7 外した・直した項目が 5 種類以上（id なし ×2・重複・必要数負・日付）', (p) => { p.rows[0].id = undefined; p.rows[1].id = ''; p.rows.push(structuredClone(p.rows[5])); p.rows[6].qtyNeeded = -1; p.rows[7].needDateFixed = '2026-13-01' }, [])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
