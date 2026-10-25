// l8: 正式見積 → 発注 → 入荷（日付を進めて期限内 2 行・遅れ 1 行）→ 入荷記録からミスミの納期遵守率（§8.1 実績 20）、入荷の Ctrl+Z
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const D0 = '2026-10-26T09:00:00+09:00'
const t = await launch({ time: D0 }); const { page } = t; const h = helpers(t)
const scores = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => [x.supplierId, x.total, x.record, x.reasons.join('・')]) }, id)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'formalRequested').map((r) => r.id).slice(0, 3)
const other = p.rows.find((r) => r.status === 'formalRequested' && r.adoptedSupplierId !== 'S3' && p.quotes.some((q) => q.rowId === r.id && q.supplierId === 'S3' && !q.stale && q.unitPrice != null)).id
log('S3 rows', s3.join(','), 'other', other, JSON.stringify((await scores(other)).find((x) => x[0] === 'S3')))
// 正式回答の前に発注しようとする
const o0 = await t.order(s3[0]); p = await t.proj(); log('order before formal answer →', o0, p.rows.find((r) => r.id === s3[0]).status)
check('L8-1 正式回答の前（正式依頼中）は発注できない（理由が出る）', p.rows.find((r) => r.id === s3[0]).status === 'formalRequested' && !p.rows.find((r) => r.id === s3[0]).ordered, o0)
await t.press('8'); for (const id of s3) { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === 'S3' && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', '10'); await t.press('Escape') }
p = await t.proj(); log('formal quotes', JSON.stringify(s3.map((id) => { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === 'S3' && !x.stale); return [id, q.leadDays, q.stock, q.formalPrice, q.formalLeadDays] }))); log('after formal answers', s3.map((id) => p.rows.find((r) => r.id === id).status).join(','))
await t.press('Escape'); for (const id of s3) log('order', id, await t.order(id))
p = await t.proj(); const ord = s3.map((id) => [id, p.rows.find((r) => r.id === id).status, p.rows.find((r) => r.id === id).orderedAt])
log('ordered', JSON.stringify(ord))
check('L8-2 正式見積済の行は o で発注済、発注日は今日（10-26）', ord.every((x) => x[1] === 'ordered' && x[2] === '2026-10-26'), JSON.stringify(ord))
async function receive(id) { await t.press('3'); await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); return t.toast() }
await t.setTime('2026-11-02T10:00:00+09:00'); log('receive 1 (11-02)', await receive(s3[0])); log('receive 2 (11-02)', await receive(s3[1]))
await t.setTime('2026-11-20T10:00:00+09:00'); log('receive 3 (11-20 遅れ)', await receive(s3[2]))
p = await t.proj(); const rec = s3.map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.receivedAt] })
log('received', JSON.stringify(rec), 'balls', JSON.stringify(await Promise.all(s3.map((id) => h.ballOf(id)))))
check('L8-3 入荷で入荷済・入荷日が記録され、ボールなし', rec[0][1] === 'received' && rec[0][2] === '2026-11-02' && rec[2][2] === '2026-11-20' && (await h.ballOf(s3[0])) == null, JSON.stringify(rec))
const sc = (await scores(other)).find((x) => x[0] === 'S3'); log('S3 score on other after receipts', JSON.stringify(sc))
check('L8-4 入荷記録（期限内 2 / 3）からミスミの実績点が 67 前後になり「実績なし」でない', sc && Math.abs(sc[2] - 67) <= 1 && !/実績なし/.test(sc[3]), JSON.stringify(sc))
await t.press('Control+z'); await page.waitForTimeout(150); p = await t.proj(); const r3 = p.rows.find((r) => r.id === s3[2])
const sc2 = (await scores(other)).find((x) => x[0] === 'S3'); log('after Ctrl+Z', r3.status, r3.receivedAt ?? '-', JSON.stringify(sc2))
check('L8-5 遅れた入荷を Ctrl+Z で戻すと発注済に戻り、実績点も 100 に戻る（期限内 2 / 2）', r3.status === 'ordered' && !r3.received && sc2 && sc2[2] === 100, `${r3.status} ${JSON.stringify(sc2)}`)
// PM の 7・ヘッダーの金額
log('header', (await t.header()).slice(0, 200)); log('money', await t.money())
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l8')
summary(); await t.close()
