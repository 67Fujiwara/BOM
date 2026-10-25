// f2: 正式見積済・差分超過の行で 調達区分を 相見積 → 指定商社（別の商社）→ 相見積 と行き来する
// 期待: 前の採用商社の正式単価・差分超過は残らない。選び直して正式見積を依頼したら回答待ち（正式依頼中）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const X = fr[0].id, Y = fr[1].id
const adX = fr[0].adoptedSupplierId, adY = fr[1].adoptedSupplierId
const other = (sid) => (sid === 'S2' ? 'S1' : 'S2')
const qX = p.quotes.find((q) => q.rowId === X && q.supplierId === adX && !q.stale), qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === adY && !q.stale)
await t.press('8')
await t.setCellKey(X, 'q.formalPrice@A', String(qX.unitPrice)); await t.press('Escape')
await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice * 100)); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); for (const id of [X, Y]) log('before', h.show(p, id), '|', await h.status(id), 'case', await h.caseOf(id))
await t.role('pm'); await t.press('7'); log('PM 7 has Y before', (await t.viewRows()).includes(Y))
// 設計: 指定商社（別の商社）へ
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
for (const [id, ad] of [[X, adX], [Y, adY]]) { await t.setCellKey(id, 'procurement', '指定商社'); await t.setCellKey(id, 'designated', NAMES[other(ad)]) }
log('publish 指定 →', await t.publish('1'))
p = await t.proj(); for (const id of [X, Y]) log('after 指定', h.show(p, id), '|', await h.status(id), 'case', await h.caseOf(id), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null, q.formalPrice ?? null])))
const yAfter = p.rows.find((r) => r.id === Y)
await t.role('pm'); await t.press('7'); const pm7 = await t.viewRows(); log('PM 7 has Y after switch', pm7.includes(Y))
await t.role('purchasing'); await t.press('8'); const v8 = await t.viewRows(); log('purch 8 has X/Y', v8.includes(X), v8.includes(Y)); log('purch status bar', (await t.status()).slice(0, 160))
check('F2-1 差分超過の行を別の商社の指定商社にしたら、前の商社の差分超過で PM の 7 に残らない', !yAfter.flags.formalDiff && !pm7.includes(Y), `formalDiff=${yAfter.flags.formalDiff} in7=${pm7.includes(Y)}`)
await t.role('pm'); await t.press('7'); await t.goto(Y); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel Y', JSON.stringify(await t.panel())); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
log('PM y Y →', JSON.stringify(await t.yes(Y, '受入')))
p = await t.proj(); log('after PM y', h.show(p, Y), '|', await h.status(Y), 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === Y).map((d) => [d.kind, d.reason])))
await t.role('purchasing'); log('order Y →', await t.order(Y)); p = await t.proj(); log('after order', h.show(p, Y), '|', await h.status(Y), 'amount', JSON.stringify(await t.S(`const d=0; const r=p.rows.find(x=>x.id==='${Y}'); return [r.ordered, r.orderQty]`)))
await t.shot('f2b')
summary(); await t.close()
