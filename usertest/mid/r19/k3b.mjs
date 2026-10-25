// k3b: 客先指定品（R034）の依頼先（因幡）を取引停止 → 行が「先行発注判断」で PM の 7 に載る → PM が y（推奨商社で選定済＋先行）
//   期待: 取引停止の因幡で選定済・発注可能にしない（§9.1「許可 → 推奨商社で選定済」の推奨に取引停止の商社を使わない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const X = 'R034'
await t.open('design'); log('bulk →', await t.bulk())
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S1' ? { ...s, tradable: false } : s)); await t.open('pm', ws)
let p = await t.proj(); log('X after stop', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
const need = await page.evaluate(async (X) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return d.rowNeedDate(p, p.rows.find((r) => r.id === X)) }, X)
log('X need date', need, 'formalDays', p.settings.formalDays)
await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('PM 7 has X', in7)
const ranks = await page.evaluate(async (X) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((x) => x.id === X), s.ws.suppliers).map((x) => [x.supplierId, x.total]) }, X)
log('scoreRow (推奨)', JSON.stringify(ranks))
check('K3B-1 取引停止の商社（因幡）がスコアの推奨に出ない（客先指定品の指定先でも）', !ranks.some((r) => r[0] === 'S1'), JSON.stringify(ranks))
if (in7) {
  const y = await t.yes(X, '先行発注を許可'); log('PM y →', y.toast)
  p = await t.proj(); const r = p.rows.find((x) => x.id === X); log('X after y', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X))
  check('K3B-2 PM の先行発注の許可で、取引停止の因幡を採用しない', r.adoptedSupplierId !== 'S1', h.show(p, X))
  await t.role('purchasing'); await t.press('3'); const ob = await t.order(X); p = await t.proj(); const r2 = p.rows.find((x) => x.id === X)
  log('order X →', ob, '|', h.show(p, X), 'ordered', r2.ordered)
  check('K3B-3 取引停止の因幡に発注しない', !(r2.ordered && r2.adoptedSupplierId === 'S1'), `${ob} ordered=${r2.ordered} adopt=${r2.adoptedSupplierId}`)
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
