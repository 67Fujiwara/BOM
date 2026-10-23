// j6: 全社辞退の相見積の行（U15-02 の修正「見積中（有効な見積なし）」）→ 購買がほかの商社（RSコンポーネンツ S4）に頼めるか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('purchasing')
let p = await t.proj()
const F = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && !r.working && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
log('F', h.show(p, F))
for (const sid of ['S1', 'S2', 'S3']) log('decline', sid, await h.decline(F, sid))
p = await t.proj(); const s1 = await h.status(F); log('F after declines', h.show(p, F), '|', s1, 'ball', await h.ballOf(F))
await t.press('4'); const in4 = (await t.viewRows()).includes(F); await t.press('9'); const in9 = (await t.viewRows()).includes(F)
log('purch 4/9 has F', in4, in9)
check('J6-1 全社辞退の行は「見積中（有効な見積なし）」で購買の 4 に出る（U15-02）', /有効な見積なし/.test(s1) && in4, `${s1} in4=${in4}`)
await t.role('design'); await t.press('1'); await t.goto(F); await t.press('a'); await page.waitForTimeout(80); const ma = await t.toast(); log('design a →', ma)
check('J6-2 選定者の a は「取引できる商社の有効な見積がありません…」と出る（先行採用を案内しない）', /有効な見積がありません/.test(ma) && !/先行採用/.test(ma), ma)
// 購買の次の手: Ctrl+. の候補
await t.role('purchasing'); await t.press('1'); await t.goto(F); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = (await t.panel())?.options ?? []; await t.press('Escape')
log('purch Ctrl+. options', JSON.stringify(qf))
// RS コンポーネンツ（S4）に概算見積を依頼
const r4 = await h.requestTo('S4'); log('request S4 →', r4.msg, JSON.stringify(r4.f.map((f) => [f.sup, f.ids.includes(F), f.ids.length])), 'options', JSON.stringify(r4.options))
p = await t.proj(); log('F after S4 request', h.show(p, F), '|', await h.status(F), 'quotes S4', JSON.stringify(p.quotes.filter((q) => q.rowId === F && q.supplierId === 'S4')))
let asked = r4.f.some((f) => f.ids.includes(F))
if (!asked) {
  // 「相見積先すべて」でも
  const ra = await h.requestTo(null); log('request all →', ra.msg, JSON.stringify(ra.f.map((f) => [f.sup, f.ids.includes(F)])))
  asked = ra.f.some((f) => f.ids.includes(F) && /RS/.test(f.sup))
}
if (!asked) {
  // 案件設定の相見積先に S4 を足してから
  log('settings supplierIds +S4 →', await h.setting('supplierIds', 'S1,S2,S3,S4', 'RS を追加'))
  p = await t.proj(); log('supplierIds', JSON.stringify(p.supplierIds), 'F', h.show(p, F), '|', await h.status(F))
  const r5 = await h.requestTo('S4'); log('request S4 after settings →', r5.msg, JSON.stringify(r5.f.map((f) => [f.sup, f.ids.includes(F)])))
  asked = r5.f.some((f) => f.ids.includes(F))
}
check('J6-3 全社辞退の行を、ほかの商社（RSコンポーネンツ）への概算見積の依頼に入れられる', asked, r4.msg)
// 回答を入れて見積済になるか
if (asked) {
  await t.press('6'); const sq = await h.q(F, 'S4', 999, 5); log('S4 answer', sq); await t.press('Escape')
  p = await t.proj(); log('F after S4 answer', h.show(p, F), '|', await h.status(F), 'ball', await h.ballOf(F))
  check('J6-4 ほかの商社の回答で見積済になり、選定者のボールに戻る', p.rows.find((r) => r.id === F).status === 'quoted', `${h.show(p, F)} | ${await h.status(F)}`)
}
if (!asked) {
  // 回避策: 6 で S4 の列に手で回答を入れる（依頼書なし）
  await t.press('6'); let sq = ''; try { sq = await h.q(F, 'S4', 999, 5) } catch (e) { sq = 'ERR ' + e.message.slice(0, 80) } await t.press('Escape')
  p = await t.proj(); log('INFO 6 で S4 に手入力 →', sq, '|', h.show(p, F), '|', await h.status(F), 'ball', await h.ballOf(F))
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j6')
summary(); await t.close()
