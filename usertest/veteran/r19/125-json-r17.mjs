// ラウンド17: JSON の数（ラウンド16 の V16-14: コンマは 3 けたごとだけ・範囲の外の設定は直して知らせる・文字の予算も数）の境目
import { open, reset, sleep, logger } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`125-json-r17-${port}${process.env.RUN ?? ""}.json`)
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
const proj = async () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { due: p.dueDate, budget: p.settings.budget, processDays: p.settings.processDays, hol: p.settings.holidays.length, R010need: p.rows.find((r) => r.id === 'R010')?.needDateFixed, R010wneed: p.rows.find((r) => r.id === 'R010')?.working?.needDateFixed, R004q: p.quotes.filter((q) => q.rowId === 'R004').map((q) => `${q.unitPrice}/${q.leadDays}/${q.moq}/${q.quoteQty}`), st: p.quotes.filter((q) => q.rowId === 'R004').map((q) => q.status ?? q.state ?? ''), set: { tie: p.settings.tieThreshold, exAmt: p.settings.exceptionAmount, exPct: p.settings.exceptionPct, quoteDays: p.settings.quoteDays, surplus: p.settings.surplusAmount, qdl: p.settings.quoteDeadline }, qdlType: typeof p.settings.quoteDeadline, lead: p.settings.leadMarginDays, tie0: p.settings.tieThreshold, R010: { st: p.rows.find((r) => r.id === 'R010')?.status, q: p.rows.find((r) => r.id === 'R010')?.qtyNeeded, prom: p.rows.find((r) => r.id === 'R010')?.promisedDate } } })
const q4 = (p) => p.quotes.filter((q) => q.rowId === 'R004')


await imp('L1 単価 "1,200.5"・"-1,200"・"+1200"', (p) => { const qs = q4(p); qs[0].unitPrice = '1,200.5'; qs[1].unitPrice = '-1,200'; qs[2].unitPrice = '+1200' }, ['R004']); log({ name: 'L1 値', v: await proj() })
await imp('L2 単価 "1 200"（空白の区切り）・".5"・"1,2345"', (p) => { const qs = q4(p); qs[0].unitPrice = '1 200'; qs[1].unitPrice = '.5'; qs[2].unitPrice = '1,2345' }, ['R004']); log({ name: 'L2 値', v: await proj() })
await imp('L3 単価 "１，２００"（全角コンマ）・"1，200"・"1,200,000.00"', (p) => { const qs = q4(p); qs[0].unitPrice = '１，２００'; qs[1].unitPrice = '1，200'; qs[2].unitPrice = '1,200,000.00' }, ['R004']); log({ name: 'L3 値', v: await proj() })
await imp('L4 設定 leadMarginDays 10.6（範囲内の小数）・processDays "12.4"（文字）・tieThreshold 150', (p) => { p.settings.leadMarginDays = 10.6; p.settings.processDays = '12.4'; p.settings.tieThreshold = 150 }, []); log({ name: 'L4 値', v: await proj() })
await imp('L5 設定 quoteDeadline "20261201"（区切りなしの日付）', (p) => { p.settings.quoteDeadline = '20261201' }, []); log({ name: 'L5 値', v: await proj() })
await imp('L6 設定 quoteDeadline 46337（Excel のシリアル値・数）', (p) => { p.settings.quoteDeadline = 46337 }, []); log({ name: 'L6 値', v: await proj() })
await imp('L7 設定 quoteDeadline "1,000"・budget "1e13"', (p) => { p.settings.quoteDeadline = '1,000'; p.settings.budget = '1e13' }, []); log({ name: 'L7 値', v: await proj() })
await imp('L8 設定 budget 2e12（数・上限超え）・formalDiffPct "10%"', (p) => { p.settings.budget = 2e12; p.settings.formalDiffPct = '10%' }, []); log({ name: 'L8 値', v: await proj() })
await imp('L9 先頭に BOM（U+FEFF）の JSON を貼る', null, [], (w) => '﻿' + JSON.stringify(w))
await imp('L10 タブで字下げした JSON（JSON.stringify(w, null, "\\t")）', null, [], (w) => JSON.stringify(w, null, '\t'))
await imp('L11 先頭に「// 書き出し 2026-10-23」の 1 行がある JSON', null, [], (w) => '// 書き出し 2026-10-23\n' + JSON.stringify(w, null, '\t'))
console.log('errors', JSON.stringify(env.errs.slice(0, 8)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
