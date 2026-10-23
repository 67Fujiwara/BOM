// i4: 取引停止にした商社で採用中・正式依頼中の行（M14-05 / M14-08 の修正の先）
//   A: 選定済（ミスミ採用、正式依頼の前）→ ミスミを取引停止 → 購買「正式見積を依頼」
//   B: 正式見積済（ミスミ）→ 取引停止 → 発注
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const scores = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => [x.supplierId, x.total]) }, id)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積' && !r.flags.leadNG && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).map((r) => r.id)
const [A, B] = s3; log('A', A, 'B', B)
// A は備考を作業中にして正式依頼から外す
await t.press('1'); await t.showCol('note'); log('A note (working) →', await t.setCellKey(A, 'note', '確認中'))
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); const qB = p.quotes.find((x) => x.rowId === B && x.supplierId === 'S3' && !x.stale)
await t.press('8'); await t.setCellKey(B, 'q.formalPrice@A', String(qB.unitPrice)); await t.press('Escape'); await t.press('Escape')
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('Home'); for (let k = 0; k < 3; k++) { await t.press('x'); await page.waitForTimeout(50) } log('publish A →', await t.publish('1'))
p = await t.proj(); for (const id of [A, B]) log('before stop', h.show(p, id), '|', await h.status(id))
// ミスミを取引停止（商社マスタ。JSON の読み込みと同じ）
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)); await t.open('purchasing', ws)
p = await t.proj(); for (const id of [A, B]) log('after stop', h.show(p, id), '|', await h.status(id), 'ball', await h.ballOf(id), 'scores', JSON.stringify(await scores(id)))
await t.press('1'); await t.goto(A); await t.press('Home'); const sbA = (await t.status()).slice(0, 220); log('statusbar A', sbA)
await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has A,B', v4.includes(A), v4.includes(B))
const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0)
log('formal →', fm); log('files', JSON.stringify(f0.map((f) => [f.sup, f.ids])))
p = await t.proj(); log('A after formal', h.show(p, A), '|', await h.status(A))
check('I4-1 取引停止の商社（ミスミ）で採用中の選定済の行に、黙って正式見積の依頼書を出さない（除外するか、知らせる）', !f0.some((f) => f.sup === 'ミスミ' && f.ids.includes(A)) || /取引停止|取引不可/.test(fm), `${fm} / ${JSON.stringify(f0.map((f) => [f.sup, f.ids]))}`)
await t.press('3'); const ob = await t.order(B); p = await t.proj(); const rB = p.rows.find((r) => r.id === B)
log('order B →', ob, '| ordered', rB.ordered)
check('I4-2 取引停止の商社の正式見積済の行は、黙って発注にしない（止めるか、知らせる）', !rB.ordered || /取引停止|取引不可/.test(ob), `${ob} ordered=${rB.ordered}`)
check('I4-3 取引停止の商社で採用中の行に、購買・選定者が気づける印がある（状態の列・ステータスバー・4 のどれか）', /取引停止|取引不可/.test(await h.status(A)) || /取引停止|取引不可/.test(sbA) || v4.includes(A), `status=${await h.status(A)} sb=${sbA.slice(0, 100)} in4=${v4.includes(A)}`)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i4')
summary(); await t.close()
