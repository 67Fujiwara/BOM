// p7: 発注・入荷・納期遵守の記録（商社マスタに実績が無い S3）。境界（納期ちょうど＝遵守／1 日遅れ＝遅れ）・入荷の取り消し・発注日の記録・マスタから消えた／取引停止
//   usage: node p7.mjs [remove|stop|none]
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { importWs, errs, scanViews } from './plib.mjs'
const mode = process.argv[2] ?? 'none'; const tag = 'P7-' + mode
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-40))
let p = await t.proj()
const mine = p.rows.filter((r) => r.status === 'formalRequested' && r.adoptedSupplierId === 'S3' && r.procurement === '相見積' && !r.needDateFixed)
log('S3 rows', mine.length); const [A, B, C, D] = mine.map((r) => r.id)
const adq = (id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
await t.press('8')
for (const id of [A, B, C, D]) { await t.setCellKey(id, 'q.formalPrice@A', String(adq(id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', '10'); await t.press('Escape') }
const ord = []; for (const id of [A, B, C, D]) ord.push(await t.order(id)); log('orders', ord.map((x) => x.slice(0, 20)).join(' | '))
p = await t.proj(); log('orderedAt', JSON.stringify([A, B, C, D].map((id) => p.rows.find((r) => r.id === id).orderedAt)))
check(`${tag}-1 発注日が記録される（今日）`, [A, B, C, D].every((id) => p.rows.find((r) => r.id === id).orderedAt === '2026-10-26'), JSON.stringify([A, B, C, D].map((id) => p.rows.find((r) => r.id === id).orderedAt)))
async function receive(id, iso) { await t.setTime(iso); await t.press('3'); await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(120); return (await t.toast()).slice(0, 50) }
const stats = () => page.evaluate(async () => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.receiptStats(s.project(), 'S3') })
log('A 11-05 (D+10) →', await receive(A, '2026-11-05T10:00:00+09:00'))
log('B 11-06 (D+11) →', await receive(B, '2026-11-06T10:00:00+09:00'))
let st = await stats(); log('stats', JSON.stringify(st))
check(`${tag}-2 納期ちょうど（発注から 10 日）は遵守、1 日遅れは遅れ → 1/2`, st && st.ok === 1 && st.total === 2, JSON.stringify(st))
log('C 11-04 →', await receive(C, '2026-11-04T10:00:00+09:00')); st = await stats(); check(`${tag}-3 前倒しの入荷は遵守 → 2/3`, st && st.ok === 2 && st.total === 3, JSON.stringify(st))
// C の入荷を外す（入荷済の行の入荷を外す）
await t.press('3'); await t.goto(C); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(120); log('C 入荷を外す →', (await t.toast()).slice(0, 60))
p = await t.proj(); const rC = p.rows.find((r) => r.id === C); st = await stats()
check(`${tag}-4 入荷を外した行は記録から消え、状態が発注済に戻る`, rC.status === 'ordered' && !rC.receivedAt && st && st.total === 2, `${rC.status} ${rC.receivedAt} ${JSON.stringify(st)}`)
// スコア内訳に実績
await t.role('design'); await t.press('2'); const other = (await t.proj()).rows.find((r) => ['formalRequested', 'selected'].includes(r.status) && r.procurement === '相見積' && r.adoptedSupplierId !== 'S3')
await t.goto(other.id); await page.keyboard.press('Space'); await page.waitForTimeout(200); let tx = await page.evaluate(() => document.body.innerText)
log('breakdown 実績:', (tx.match(/実績[^\n]{0,60}/g) ?? []).join(' | ').slice(0, 200))
check(`${tag}-5 見積済の行のスコア内訳に S3 の「この案件の入荷 1/2 件が納期内」が出る`, /この案件の入荷 1\/2 件/.test(tx), (tx.match(/実績[^\n]{0,60}/g) ?? []).join(' | ').slice(0, 200))
await page.keyboard.press('Escape'); if (await t.panel()) await page.keyboard.press('Escape')
if (mode !== 'none') {
  log(mode, await importWs(t, (ws) => { ws.suppliers = mode === 'remove' ? ws.suppliers.filter((s) => s.id !== 'S3') : ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)) }))
  await t.role('purchasing'); await t.press('3'); await t.goto(D); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(150); p = await t.proj()
  check(`${tag}-6 商社が${mode === 'remove' ? 'マスタから消えて' : '取引停止になって'}も、発注済の D は入荷できる`, p.rows.find((r) => r.id === D).status === 'received', h.show(p, D).slice(0, 150))
  const bad = await scanViews(t, ['purchasing', 'design'], [2, 3, 5, 8, 9]); check(`${tag}-7 画面の文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
}
errs(t, tag + '-9'); summary(); await t.close()
