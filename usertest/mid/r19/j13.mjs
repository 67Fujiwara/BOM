// j13: 商社マスタでミスミを取引停止にした JSON を「JSON を読み込む」（Ctrl+K）で読み込む → 採用中の行と、続けて押した「正式見積を依頼」
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const A = p.rows.find((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積' && !r.flags.leadNG && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
log('A', h.show(p, A))
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s))
await t.role('purchasing'); await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(200)
for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; log('confirm panel', pn.title?.slice(0, 80), JSON.stringify(pn.options ?? [])); const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(200) }
log('import →', await t.toast())
const sup = await t.S('return st.ws.suppliers.find((s) => s.id === "S3").tradable'); log('S3 tradable', sup)
p = await t.proj(); const s0 = await h.status(A); const rA0 = p.rows.find((r) => r.id === A); log('A after import', h.show(p, A), '|', s0)
check('J13-1 JSON を読み込んだ直後から、取引停止の商社（ミスミ）の採用は外れて選び直しになっている', !rA0.adoptedSupplierId, `${h.show(p, A)} | ${s0}`)
await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0)
p = await t.proj(); log('formal →', fm, JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(A), f.ids.length])), '|', h.show(p, A), '|', await h.status(A))
check('J13-2 読み込みの直後に押した正式見積の依頼で、取引停止のミスミに依頼書を出さない', !f0.some((f) => f.sup === 'ミスミ'), JSON.stringify(f0.map((f) => [f.sup, f.ids.length])))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j13')
summary(); await t.close()
