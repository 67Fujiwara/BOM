// i6: 入荷記録からの納期遵守率（M14-10 の修正）。遅れて入荷した行・発注を飛ばした入荷・入荷の取り消し
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch({ time: '2026-10-23T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
const scores = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => [x.supplierId, x.total, x.record, x.reasons.join('・')]) }, id)
const rate = (sid) => page.evaluate(async (sid) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const x = sc.receiptStats ? sc.receiptStats(s.project(), sid) : null; return sc.receiptRate ? sc.receiptRate(s.project(), sid) : x ? x.ok / x.total : null }, sid)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'formalRequested').map((r) => r.id).slice(0, 3)
const other = p.rows.find((r) => r.status === 'formalRequested' && r.adoptedSupplierId !== 'S3' && p.quotes.some((q) => q.rowId === r.id && q.supplierId === 'S3' && !q.stale && q.unitPrice != null)).id
log('S3 rows', s3.join(','), 'leads', JSON.stringify(s3.map((id) => { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === 'S3' && !x.stale); return [q.leadDays, q.stock ?? ''] })))
await t.press('8'); for (const id of s3) { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === 'S3' && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
await t.press('Escape'); for (const id of s3.slice(0, 2)) log('order', id, await t.order(id))
// 60 日後に入荷（どの納期よりも遅い）
await t.setTime('2026-12-22T09:00:00+09:00'); await page.waitForTimeout(100)
await t.press('3'); for (const id of s3.slice(0, 2)) { await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(80); log('receive', id, await t.toast()) }
p = await t.proj(); log('records', JSON.stringify(s3.map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.orderedAt, r.receivedAt] })))
await t.setTime('2026-10-24T09:00:00+09:00'); await page.waitForTimeout(100)
const r1 = await rate('S3'); const sc1 = await scores(other); log('S3 rate', r1, 'other scores', JSON.stringify(sc1))
check('I6-1 納期より 60 日遅れて入荷した 2 行だけのミスミは、納期遵守率 0（実績点 0、「実績なし」でない）', r1 === 0 && sc1.find((x) => x[0] === 'S3')?.[2] === 0 && !/実績なし/.test(sc1.find((x) => x[0] === 'S3')?.[3] ?? ''), `rate=${r1} ${JSON.stringify(sc1.find((x) => x[0] === 'S3'))}`)
// 3 行目: 発注を飛ばして入荷列だけ Enter（同じ日）
await t.goto(s3[2]); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(80); const m3 = await t.toast()
p = await t.proj(); const r3 = p.rows.find((x) => x.id === s3[2]); log('receive without order', s3[2], m3, '|', r3.status, r3.orderedAt, r3.receivedAt, 'rate', await rate('S3'))
log('INFO 発注を飛ばした入荷は 発注日=入荷日 で「納期どおり」に数える:', r3.received ? `rate ${await rate('S3')}` : '入荷できない')
// 入荷を取り消すと集計から外れる
await t.goto(s3[0]); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(80); log('unreceive', s3[0], await t.toast())
p = await t.proj(); const r0 = p.rows.find((x) => x.id === s3[0]); log('after unreceive', r0.status, r0.receivedAt, 'rate', await rate('S3'))
check('I6-2 入荷を取り消した行は集計から外れる', !r0.received && r0.receivedAt == null, `${r0.status} ${r0.receivedAt}`)
// スコアの内訳（Space）に実績の出どころが出るか
await t.press('1'); await t.goto(other); await t.press('Space'); await page.waitForTimeout(150); const det = ((await page.locator('[data-testid=detail]').count()) ? await page.getByTestId('detail').textContent() : await t.dialog()) ?? ''; await t.press('Escape')
log('detail other', det.slice(0, 500))
check('I6-3 スコアの内訳に実績の出どころ（この案件の入荷 n/m 件が納期内）が出る（U15-05）', /入荷 \d+\/\d+ 件/.test(det), det.slice(0, 300))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i6')
summary(); await t.close()
