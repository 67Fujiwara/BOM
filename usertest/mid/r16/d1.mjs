// d1: 依頼したあとで相見積先から外した商社・取引不可にした商社を待つか（ラウンド10 の修正「外した・取引不可の商社には依頼しない・待たない」）
// mode=remove: 全社で 3 社に依頼 → 因幡・立花が回答 → 案件設定でミスミを外す
// mode=tradable: 全社で因幡だけに依頼 → ミスミを商社マスタで取引不可に（保存データの更新＝JSON 読み込み）→ 相見積先すべて → 因幡・立花が回答
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'remove'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '外す前に依頼A', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '外す前に依頼B', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
let p
if (mode === 'remove') {
  const r1 = await h.requestTo(null); log('all →', r1.msg)
  await t.press('6'); await h.q(A, 'S1', 1500, 5); await h.q(A, 'S2', 1400, 6); await t.press('Escape')
  p = await t.proj(); log('A before', h.show(p, A), '|', await h.status(A))
  log('supplierIds →', await h.setting('supplierIds', 'S1,S2', 'ミスミは今回外す'))
  p = await t.proj(); log('project', JSON.stringify(p.supplierIds)); log('A after remove', h.show(p, A), '|', await h.status(A), 'ball', await h.ballOf(A))
  check('D1-1 依頼後に相見積先から外したミスミの回答を待たない（因幡・立花の回答で全社の見積済）', p.rows.find((r) => r.id === A).status === 'quoted', `${p.rows.find((r) => r.id === A).status} ${await h.status(A)}`)
  await t.press('4'); const in4 = (await t.viewRows()).includes(A); log('purch 4 has A', in4)
  await t.role('design'); await t.press('1'); await t.goto(A); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast())
} else {
  const r1 = await h.requestTo('S1'); log('S1 only →', r1.msg)
  p = await t.proj(); log('A targets', JSON.stringify(p.rows.find((r) => r.id === A).quoteTargets), await h.status(A))
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s))
  await t.open('purchasing', ws)
  log('suppliers', JSON.stringify((await t.ws()).suppliers.map((s) => [s.id, s.tradable])))
  log('A status after master update', await h.status(A))
  const r2 = await h.requestTo(null); log('all →', r2.msg, 'label', r2.options[0], JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
  check('D1-2 取引不可にしたミスミには依頼書を出さない', !r2.f.some((f) => f.sup === 'ミスミ'), JSON.stringify(r2.f.map((f) => f.sup)))
  check('D1-3 「相見積先すべて」の選択肢の名前に、依頼しない取引不可のミスミを出さない', !r2.options[0].includes('ミスミ'), r2.options[0])
  await t.press('6'); await h.q(A, 'S1', 1500, 5); await h.q(A, 'S2', 1400, 6); await t.press('Escape')
  p = await t.proj(); log('A after S1,S2', h.show(p, A), '|', await h.status(A), 'targets', JSON.stringify(p.rows.find((r) => r.id === A).quoteTargets))
  check('D1-4 (全社) 取引不可で頼まないミスミを待たない（因幡・立花の回答で見積済）', p.rows.find((r) => r.id === A).status === 'quoted', `${p.rows.find((r) => r.id === A).status} ${await h.status(A)}`)
  await t.press('4'); const in4 = (await t.viewRows()).includes(A); log('purch 4 has A', in4)
  const r3 = await h.requestTo(null); log('all again →', r3.msg)
  await t.role('design'); await t.press('1'); await t.goto(A); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast())
}
await t.shot('d1-' + mode)
summary(); await t.close()
