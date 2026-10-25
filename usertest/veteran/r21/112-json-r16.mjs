// ラウンド16: JSON の文字の数・設定の文字の数・行の日付（V15-10 の修正: 「1,200」「¥1200」・全角は数に、設定の "10" も数に、行の日付も納期と同じ書き方）の境目
import { open, reset, sleep, logger } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`112-json-r16-${port}${process.env.RUN ?? ""}.json`)
const LSK = 'bom-pro.workspace.v2'
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 600) ?? '')
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
async function imp(name, mutate, pick, raw) {
  await reset(env)
  const w = structuredClone(base); const p = w.projects.find((x) => x.id === w.currentProjectId); mutate?.(p, w)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  const text = raw ? raw(w) : JSON.stringify(w)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); const t0 = Date.now(); await pg.keyboard.press('Control+Enter'); await sleep(250)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('2'); await sleep(400) }
  const ms = Date.now() - t0
  const t = await toast()
  const after = await pg.evaluate(([k, ids]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const o = { rows: p.rows.length, issues: p.issues.length, quotes: p.quotes.length, issueIds: p.issues.slice(-2).map((i) => `${i.id}:${i.rowId}`) }; for (const id of ids) { const r = p.rows.find((x) => x.id === id); o[id] = r ? { qty: r.qtyNeeded, wq: r.working?.qtyNeeded, need: r.needDateFixed, wneed: r.working?.needDateFixed, pack: r.packQty, wpack: r.working?.packQty, order: r.orderQty, q: p.quotes.filter((q) => q.rowId === id).map((q) => q.unitPrice + '/' + q.leadDays).join(' ') } : null } return o }, [LSK, pick ?? []])
  const shown = await pg.evaluate((ids) => ids.map((id) => { const tr = document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`); return tr ? `${id}: ${tr.textContent.replace(/\s+/g, ' ').slice(0, 150)}` : `${id}: (表示なし)` }), pick ?? [])
  log({ name, ms, toast: t, after, shown, panel: await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null) })
  await pg.keyboard.press('Escape')
}
const R = (p, id) => p.rows.find((r) => r.id === id)
const proj = async () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { due: p.dueDate, budget: p.settings.budget, processDays: p.settings.processDays, hol: p.settings.holidays.length, R010need: p.rows.find((r) => r.id === 'R010')?.needDateFixed, R010wneed: p.rows.find((r) => r.id === 'R010')?.working?.needDateFixed, R004q: p.quotes.filter((q) => q.rowId === 'R004').map((q) => `${q.unitPrice}/${q.leadDays}/${q.moq}/${q.quoteQty}`), st: p.quotes.filter((q) => q.rowId === 'R004').map((q) => q.status ?? q.state ?? ''), set: { tie: p.settings.tieThreshold, exAmt: p.settings.exceptionAmount, exPct: p.settings.exceptionPct, quoteDays: p.settings.quoteDays, surplus: p.settings.surplusAmount, qdl: p.settings.quoteDeadline }, R010: { st: p.rows.find((r) => r.id === 'R010')?.status, q: p.rows.find((r) => r.id === 'R010')?.qtyNeeded, prom: p.rows.find((r) => r.id === 'R010')?.promisedDate } } })
const q4 = (p) => p.quotes.filter((q) => q.rowId === 'R004')

await imp('K1 単価 "12,5"（小数点がコンマ）・"1.200"（桁区切りが点）・"1,2,3"', (p) => { const qs = q4(p); qs[0].unitPrice = '12,5'; qs[1].unitPrice = '1.200'; qs[2].unitPrice = '1,2,3' }, ['R004']); log({ name: 'K1 値', v: await proj() })
await imp('K2 単価 "¥1,200-"（伝票の書き方）・"1200円(税別)"・"▲500"', (p) => { const qs = q4(p); qs[0].unitPrice = '¥1,200-'; qs[1].unitPrice = '1200円(税別)'; qs[2].unitPrice = '▲500' }, ['R004']); log({ name: 'K2 値', v: await proj() })
await imp('K3 単価 "−5"（U+2212 の負号）・"abc"・"TBD"', (p) => { const qs = q4(p); qs[0].unitPrice = '−5'; qs[1].unitPrice = 'abc'; qs[2].unitPrice = 'TBD' }, ['R004']); log({ name: 'K3 値', v: await proj() })
await imp('K4 単価 "1e3"・"0x10"・"Infinity"', (p) => { const qs = q4(p); qs[0].unitPrice = '1e3'; qs[1].unitPrice = '0x10'; qs[2].unitPrice = 'Infinity' }, ['R004']); log({ name: 'K4 値', v: await proj() })
await imp('K5 MOQ "1,000"・数量 "１０"・leadDays "１２"（全角）', (p) => { const qs = q4(p); qs[0].moq = '1,000'; qs[0].quoteQty = '１０'; qs[0].leadDays = '１２' }, ['R004']); log({ name: 'K5 値', v: await proj() })
await imp('K6 設定の予算 "1,200,000"・"¥1,200,000"（予算は既定が空）', (p) => { p.settings.budget = '1,200,000' }, []); log({ name: 'K6 値', v: await proj() })
await imp('K7 設定の工程日数 "1,000"・同点のしきい値 "abc"・例外の額 "¥10,000"・例外の率 "3%"', (p) => { p.settings.processDays = '1,000'; p.settings.tieThreshold = 'abc'; p.settings.exceptionAmount = '¥10,000'; p.settings.exceptionPct = '3%' }, []); log({ name: 'K7 値', v: await proj() })
await imp('K8 設定の工程日数 "-5"（文字）・余剰の額 "-1"', (p) => { p.settings.processDays = '-5'; p.settings.surplusAmount = '-1' }, []); log({ name: 'K8 値', v: await proj() })
await imp('K9 設定の見積日数 "1e3"・回答期限 quoteDeadline "2026-12-1"', (p) => { p.settings.quoteDays = '1e3'; p.settings.quoteDeadline = '2026-12-1' }, []); log({ name: 'K9 値', v: await proj() })
await imp('K10 行の必要日 "2026-02-30T00:00"・"2026-11-11T99:99"・回答納期 promisedDate "2026-1-5"', (p) => { R(p, 'R010').needDateFixed = '2026-02-30T00:00'; R(p, 'R011').needDateFixed = '2026-11-11T99:99'; R(p, 'R010').promisedDate = '2026-1-5' }, ['R010', 'R011']); log({ name: 'K10 値', v: await proj() })
await imp('K11 行の必要日 46337（数・Excel のシリアル値）・作業中の必要日 46337', (p) => { R(p, 'R010').needDateFixed = 46337; R(p, 'R011').working = { needDateFixed: 46337 } }, ['R010', 'R011']); log({ name: 'K11 値', v: await proj() })
await imp('K12 行の必要数 "1,000"・"１２"・"12個"', (p) => { R(p, 'R010').qtyNeeded = '1,000'; R(p, 'R011').qtyNeeded = '１２'; R(p, 'R012').qtyNeeded = '12個' }, ['R010', 'R011', 'R012'])
await imp('K13 作業中の必要数 "1,000"・入数 "10"（文字）', (p) => { R(p, 'R010').working = { qtyNeeded: '1,000' }; R(p, 'R011').working = { packQty: '10' } }, ['R010', 'R011'])
await imp('K14 単価 "1000000000001"（1e12 超の文字）・formalPrice "-0"', (p) => { const qs = q4(p); qs[0].unitPrice = '1000000000001'; qs[1].formalPrice = '-0' }, ['R004']); log({ name: 'K14 値', v: await proj() })
console.log('errors', JSON.stringify(env.errs.slice(0, 8)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
