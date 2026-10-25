// j2: 取引停止（M15-04 の修正）を指定商社の行で。指定先＝ミスミの行で、ミスミを取引停止にする
//   A: 指定商社ミスミ・選定済（正式依頼の前）  B: 指定商社ミスミ・正式見積済
//   期待: 取引停止の商社に黙って正式見積の依頼・発注を出さない。少なくとも知らせて、指定先を設計と確かめる（概算の依頼と同じ）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const cands = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'quoted' && r.procurement === '相見積' && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const [A, B] = [cands[0].id, cands[1].id]
log('A', h.show(p, A)); log('B', h.show(p, B))
await t.press('1'); await t.showCol('designated', 'procurement', 'note')
for (const id of [A, B]) { await t.setCellKey(id, 'procurement', '指定商社'); await t.setCellKey(id, 'designated', 'ミスミ') }
log('publish 指定商社 →', await t.publish('1'))
log('bulk →', await t.bulk())
// A は備考を作業中にして正式依頼から外す
log('A note (working) →', await t.setCellKey(A, 'note', '確認中'))
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); const qB = p.quotes.find((x) => x.rowId === B && x.supplierId === 'S3' && !x.stale)
await t.press('8'); await t.setCellKey(B, 'q.formalPrice@A', String(qB.unitPrice)); await t.press('Escape'); await t.press('Escape')
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('Home'); log('publish A →', await t.publish('1'))
p = await t.proj(); for (const id of [A, B]) log('before stop', h.show(p, id), '|', await h.status(id))
// ミスミを取引停止（商社マスタ。JSON の読み込みと同じ）
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)); await t.open('purchasing', ws)
p = await t.proj(); const st = {}
for (const id of [A, B]) { const r = p.rows.find((x) => x.id === id); st[id] = { status: r.status, adopt: r.adoptedSupplierId ?? null, wd: r.flags.formalWithdrawn ?? null, text: await h.status(id), ball: await h.ballOf(id) }; log('after stop', h.show(p, id), 'withdrawn=', st[id].wd ?? '-', '|', st[id].text, 'ball', st[id].ball) }
await t.press('1'); await t.goto(A); await t.press('Home'); const sbA = (await t.status()).slice(0, 240); log('statusbar A', sbA)
await t.goto(B); await t.press('Home'); const sbB = (await t.status()).slice(0, 240); log('statusbar B', sbB)
await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has A,B', v4.includes(A), v4.includes(B))
await t.role('design'); await t.press('4'); const d4 = await t.viewRows(); log('design 4 has A,B', d4.includes(A), d4.includes(B))
const dA = await t.cellText(A, 'status'); log('design status A', dA)
await t.role('purchasing')
const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0)
log('formal →', fm); log('files', JSON.stringify(f0.map((f) => [f.sup, f.ids])))
p = await t.proj(); for (const id of [A, B]) log('after formal', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
check('J2-1 指定先が取引停止（ミスミ）の選定済の行に、黙って正式見積の依頼書を出さない（除外するか、取引停止と知らせる）', !f0.some((f) => f.sup === 'ミスミ' && f.ids.includes(A)) || /取引停止|取引不可/.test(fm), `${fm} / ${JSON.stringify(f0.map((f) => [f.sup, f.ids]))}`)
check('J2-2 取引停止の指定先の行に、購買・設計が気づける印がある（状態の列・ステータスバー・4）', /取引停止|取引不可/.test(st[A].text + sbA + dA) || d4.includes(A), `A text=${st[A].text} sb=${sbA.slice(0, 120)} design4=${d4.includes(A)}`)
const rB0 = p.rows.find((r) => r.id === B)
log('B state for order', h.show(p, B), '|', await h.status(B))
await t.press('3'); const ob = await t.order(B); p = await t.proj(); const rB = p.rows.find((r) => r.id === B)
log('order B →', ob, '| ordered', rB.ordered)
check('J2-3 指定先が取引停止の正式見積済の行は、黙って発注にしない（止めるか、知らせる）', !rB.ordered || /取引停止|取引不可/.test(ob), `${ob} ordered=${rB.ordered} before=${rB0.status}`)
check('J2-4 取下げの印と依頼先が食い違わない（同じミスミに出し直した行に「ミスミへの取下げ」が残らない／取下げた商社に依頼し直さない）', [A, B].every((id) => { const r = p.rows.find((x) => x.id === id); return !(r.flags.formalWithdrawn?.startsWith('ミスミ') && r.adoptedSupplierId === 'S3' && r.status !== 'ordered') }), JSON.stringify([A, B].map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.adoptedSupplierId, r.flags.formalWithdrawn ?? null] })))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j2')
summary(); await t.close()
