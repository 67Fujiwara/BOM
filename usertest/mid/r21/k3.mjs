// k3: 客先指定品（R034 オムロン、依頼先＝因幡 S1 で採用済）の依頼先を取引停止に
//   §3.1「見積先の商社は購買が 6 で 1 社を指定。既定＝そのメーカを扱う第 1 商社」、M16-02 の修正（取引停止の指定先は採用しない）
//   期待: 因幡の採用は外れ、購買が次の商社（オムロンを扱う立花）に頼める。行が誰のボールでもなく止まらない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const X = 'R034'
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj(); log('X before stop', h.show(p, X), '|', await h.status(X))
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S1' ? { ...s, tradable: false } : s)); await t.open('purchasing', ws)
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); const st0 = await h.status(X); const ball0 = await h.ballOf(X)
log('X after stop', h.show(p, X), '|', st0, 'ball', ball0)
check('K3-1 取引停止の依頼先（因幡）の採用は外れる', r0.adoptedSupplierId !== 'S1', h.show(p, X))
const fixed = await page.evaluate(async (X) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return d.fixedSupplierId(p, p.rows.find((r) => r.id === X), s.ws.suppliers) }, X)
log('fixedSupplierId', fixed)
await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 300); log('purch statusbar', sb)
await t.press('Control+.'); await page.waitForTimeout(100); const qf = (await t.panel())?.options ?? []; await t.press('Escape'); log('purch Ctrl+. options', JSON.stringify(qf))
await t.press('4'); const p4 = (await t.viewRows()).includes(X); await t.press('9'); const p9 = (await t.viewRows()).includes(X)
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(X); await t.role('purchasing')
log('purch 4/9, design 4', p4, p9, d4)
check('K3-2 依頼先が取引停止の客先指定品は、誰かの 4 に出て次の手（次の商社に依頼・依頼先を変える）が分かる', (p4 || d4) && (/取引停止|次の商社|依頼先/.test(sb) || qf.some((o) => /次の商社|依頼先|ほかの商社/.test(o))), `ball=${ball0} p4=${p4} d4=${d4} sb=${sb.slice(0, 120)} qf=${JSON.stringify(qf)}`)
// 購買が概算見積を依頼（相見積先すべて / 立花）
const rq = await h.requestTo(null); log('rough all →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
let asked = rq.f.some((f) => f.ids.includes(X) && f.sup === '立花エレテック')
if (!asked) { const r2 = await h.requestTo('S2'); log('rough S2 →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(X)]))); asked = r2.f.some((f) => f.ids.includes(X)) }
check('K3-3 次の商社（立花エレテック）に概算見積を頼める', asked, rq.msg)
await t.press('6'); log('S2 answer', await h.q(X, 'S2', 400, 10)); await t.press('Escape')
p = await t.proj(); const r1 = p.rows.find((r) => r.id === X); log('X after S2 answer', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X))
check('K3-4 次の商社の回答で、その商社が採用されて選定済（客先指定品はスコアなしで固定）', r1.adoptedSupplierId === 'S2' && r1.status === 'selected', h.show(p, X))
const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0)
log('formal →', fm, JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(X)])))
check('K3-5 取引停止の因幡には正式見積の依頼書が出ない', !f0.some((f) => f.sup === '因幡電機'), JSON.stringify(f0.map((f) => f.sup)))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k3')
summary(); await t.close()
