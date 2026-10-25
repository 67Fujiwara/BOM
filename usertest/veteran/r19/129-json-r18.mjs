// ラウンド18: ラウンド17 の読み込みの修正（V17-11/12: 日付の設定は日付だけ・読めない設定は知らせる・丸めは範囲外と言わない、
// V17-01: 印の型をそろえる、V17-02: 41 段より深い値は外して知らせる）の境目を JSON の読み込み（Ctrl+K →「JSON を読み込む」）と起動（localStorage）で
import { open, reset, sleep, logger } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`129-json-r18-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 700) ?? '')
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
const cur = (w) => w.projects.find((x) => x.id === w.currentProjectId)
const nest = (n, leaf) => { let v = leaf; for (let i = 0; i < n; i++) v = [v]; return v }
// 深い入れ子は文字で作る（node の JSON.stringify が止まるので）
const DEEP = (n, leafJson) => '['.repeat(n) + leafJson + ']'.repeat(n)
const deepText = (w) => JSON.stringify(w).replace(/"@@DEEP(\d+)@@"/g, (_, n) => DEEP(Number(n), '"x"'))
const proj = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = (id) => p.rows.find((x) => x.id === id); return { qdl: p.settings.quoteDeadline, qdlType: typeof p.settings.quoteDeadline, lead: p.settings.leadMarginDays, proc: p.settings.processDays, budget: p.settings.budget, tie: p.settings.tieThreshold, R004q: p.quotes.filter((q) => q.rowId === 'R004').map((q) => `${q.unitPrice}/${q.leadDays}/${q.moq}`), R005: { qty: r('R005')?.qtyNeeded, name: r('R005')?.name, flags: r('R005')?.flags, status: r('R005')?.status }, R006: { name: r('R006')?.name, junk: JSON.stringify(r('R006')?.junk ?? null).slice(0, 80) } } }, LSK)
async function imp(name, mutate, raw) {
  await reset(env); env.errs.length = 0
  const w = structuredClone(base); const p = cur(w); mutate?.(p, w)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  const text = raw ? raw(w) : deepText(w)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); const t0 = Date.now(); await pg.keyboard.press('Control+Enter'); await sleep(300)
  let confirm = ''
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { confirm = (await pg.evaluate(() => document.querySelector('[data-testid="panel-prompt"]')?.textContent?.slice(0, 300) ?? '')); await pg.keyboard.press('2'); await sleep(500) }
  const ms = Date.now() - t0
  const t = await toast()
  const v = await proj()
  log({ name, ms, confirm, toast: t, v, errs: env.errs.filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 160)) })
  await pg.keyboard.press('Escape')
  return v
}
// 起動時（localStorage に直接入れてリロード）
async function boot(name, mutate) {
  await reset(env); env.errs.length = 0
  const w = structuredClone(base); const p = cur(w); mutate(p, w)
  await pg.evaluate(([k, s]) => localStorage.setItem(k, s), [LSK, deepText(w)])
  await pg.reload(); await sleep(1200)
  const grid = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
  const t = await toast()
  const v = grid ? await proj() : null
  // 編集できるか（R001 の部品名を打って Enter）→ リロード
  let edit = null
  if (grid) {
    await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R001'); await pg.keyboard.press('Enter'); await sleep(150)
    await pg.keyboard.press('Home'); for (let i = 0; i < 8; i++) { const c = await pg.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent ?? ''); if (c.includes('部品名')) break; await pg.keyboard.press('ArrowRight') }
    await pg.keyboard.type('編集X'); await pg.keyboard.press('Enter'); await sleep(400)
    edit = await pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R001'); return (r.working?.name ?? r.name) }, LSK)
    await pg.reload(); await sleep(1200)
  }
  const grid2 = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
  log({ name, grid, toast: t, v, edit, gridAfterReload: grid2, errs: env.errs.filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 160)) })
}

// --- 日付の設定（V17-11 の修正）---
await imp('N1 quoteDeadline "2026/12/01"（スラッシュ。画面の欄では読める形）', (p) => { p.settings.quoteDeadline = '2026/12/01' })
await imp('N2 quoteDeadline "20261201"', (p) => { p.settings.quoteDeadline = '20261201' })
await imp('N3 quoteDeadline 46337（Excel のシリアル値）', (p) => { p.settings.quoteDeadline = 46337 })
await imp('N4 quoteDeadline "2026-02-30"（無い日）', (p) => { p.settings.quoteDeadline = '2026-02-30' })
await imp('N5 quoteDeadline true', (p) => { p.settings.quoteDeadline = true })
await imp('N6 quoteDeadline "0001-01-01"（実在するが範囲外の年）', (p) => { p.settings.quoteDeadline = '0001-01-01' })
await imp('N7 quoteDeadline "2026-12-01T00:30:00+09:00"（時刻つき）', (p) => { p.settings.quoteDeadline = '2026-12-01T00:30:00+09:00' })
// --- 数の設定 ---
await imp('N8 leadMarginDays true・processDays {}・tieThreshold []（文字でも数でもない）', (p) => { p.settings.leadMarginDays = true; p.settings.processDays = {}; p.settings.tieThreshold = [] })
await imp('N9 budget "abc"・leadMarginDays "abc"', (p) => { p.settings.budget = 'abc'; p.settings.leadMarginDays = 'abc' })
await imp('N10 leadMarginDays 10.6（丸め）・processDays 0.4', (p) => { p.settings.leadMarginDays = 10.6; p.settings.processDays = 0.4 })
// --- 行・見積の読めない数（V17-12 の残り）---
await imp('N11 見積の単価 "abc"・"12,5"・"1e3"', (p) => { const qs = p.quotes.filter((q) => q.rowId === 'R004'); qs[0].unitPrice = 'abc'; qs[1].unitPrice = '12,5'; if (qs[2]) qs[2].unitPrice = '1e3' })
await imp('N12 R005 の必要数 "abc"・"12,5"', (p) => { p.rows.find((r) => r.id === 'R005').qtyNeeded = 'abc' })
// --- 印の型（V17-01 の修正）---
await imp('N13 R005 の印 pmPending "true"（文字）・capRuled "1000"・countermeasure 1・formalWithdrawn ["x"]', (p) => { const r = p.rows.find((x) => x.id === 'R005'); r.flags = { ...r.flags, pmPending: 'true', capRuled: '1000', countermeasure: 1, formalWithdrawn: ['x'], pmReason: '例外選定' } })
await imp('N14 R005 の印に知らない印 foo: "bar"・印が配列 []', (p) => { const r = p.rows.find((x) => x.id === 'R005'); r.flags = [] })
// --- 深い入れ子（V17-02 の修正）---
await imp('N15 R006 に深さ 40 の配列（外さない境目）', (p) => { p.rows.find((r) => r.id === 'R006').junk = nest(34, 1) })
await imp('N16 R006 に深さ 50 の配列', (p) => { p.rows.find((r) => r.id === 'R006').junk = nest(50, 1) })
await imp('N17 R006 の部品名が深さ 5,000 の配列', (p) => { p.rows.find((r) => r.id === 'R006').name = '@@DEEP5000@@' })
await imp('N18 案件に 30 万個の配列（広い）', (p) => { p.junk = Array.from({ length: 300000 }, (_, i) => i) })
await imp('N19 案件の設定に深さ 60 のオブジェクト', (p) => { let o = { v: 1 }; for (let i = 0; i < 60; i++) o = { o }; p.settings.junk = o })
// --- 起動時 ---
await boot('B1 起動: R006 に深さ 5,000 の配列', (p) => { p.rows.find((r) => r.id === 'R006').junk = '@@DEEP5000@@' })
await boot('B2 起動: quoteDeadline "2026/12/01"・leadMarginDays "abc"', (p) => { p.settings.quoteDeadline = '2026/12/01'; p.settings.leadMarginDays = 'abc' })
await boot('B3 起動: R013 formalWithdrawn false＋S1 取引停止（V17-01 の形）', (p, w) => { w.suppliers.find((s) => s.id === 'S1').tradable = false; p.rows.find((r) => r.id === 'R013').flags.formalWithdrawn = false })
await boot('B4 起動: R005 の印 pmPending "true"（文字）', (p) => { const r = p.rows.find((x) => x.id === 'R005'); r.flags = { ...r.flags, pmPending: 'true', pmReason: '例外選定' } })
console.log('errors', JSON.stringify(env.errs.slice(0, 8)))
log.save(); await env.browser.close()
