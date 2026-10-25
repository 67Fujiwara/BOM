// a5: 採用後に指定先が「取扱なし」に変わった行の行き先（設計が指定先を変えた後に購買が頼めるか）、相見積の行で採用商社が取扱なしに変わった場合、
//     客先指定品が案件の商社すべてに辞退されたとき（RS を選んで頼めるか）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} des=${r.designated ?? ''} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} flags=${JSON.stringify(r.flags)} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const G = await addRow('R080', '因幡指定', 'UK5N', 'フエニックス', '指定商社', '因幡電機')
const K = await addRow(G, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('request →', await t.requestRough())
await t.press('6'); await t.setCellKey(G, 'q.unitPrice@S1', '800'); await t.press('Escape'); await t.setCellKey(G, 'q.leadDays@S1', '5'); await t.press('Escape')
let p = await t.proj(); log('G answered', show(p, G))
// 回答の訂正: 因幡「やっぱり取扱なし」
log('G decline after adopt →', await t.setCellKey(G, 'q.leadDays@S1', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('G after decline', show(p, G), 'ball', await t.cellText(G, 'ball'))
await t.press('8'); const in8 = (await t.viewRows()).includes(G)
log('formal →', await t.requestFormal()); p = await t.proj(); log('G after formal request', show(p, G))
check('A5-1 採用した指定先の回答を「取扱なし」に直したら、採用が外れ選定済のまま正式依頼に進まない', p.rows.find((r) => r.id === G).status !== 'formalRequested' && !p.rows.find((r) => r.id === G).adoptedSupplierId, show(p, G))
// 設計が指定先を立花に変えて公開 → 購買が頼めるか
await t.role('design'); await t.press('1'); log('design change designated', await t.setCellKey(G, 'designated', '立花エレテック')); log('publish →', await t.publish('6'))
p = await t.proj(); log('G after designated change', show(p, G))
await t.role('purchasing'); const rq = await t.requestRough(); p = await t.proj(); log('request →', rq, show(p, G))
check('A5-2 指定先を変えたら新しい指定先に頼める（採用が残って止まらない）', p.quotes.some((q) => q.rowId === G && q.supplierId === 'S2' && !q.stale), rq)
// 客先指定品 K: S2 辞退 → S3 → S1 全部辞退 → RS（S4）を選んで頼めるか
for (let i = 0; i < 3; i++) {
  p = await t.proj(); const live = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1)
  if (!live.length) { const r = await t.requestRough(); log('next request', r); p = await t.proj() }
  const cur = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1)[0]
  if (!cur) break
  await t.press('6'); await t.setCellKey(K, `q.leadDays@${cur.supplierId}`, '取扱なし'); await t.press('Escape'); log('declined by', cur.supplierId)
}
p = await t.proj(); log('K all declined', show(p, K), 'ball', await t.cellText(K, 'ball'))
await t.press('4'); await t.goto(K); await t.press('Home'); const sb = await t.status(); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); const qfToast = await t.toast(); if (qf) await t.press('Escape')
log('K sb', sb.slice(0, 220), 'Ctrl+.', JSON.stringify(qf?.options), qfToast)
check('A5-3 全社辞退の行で、ステータスバーが「Ctrl+. 次の商社に依頼」と出るなら Ctrl+. に候補がある', !/次の商社に依頼/.test(sb) || !!qf?.options?.length, `sb has hint, Ctrl+. → ${JSON.stringify(qf?.options)} ${qfToast}`)
// RS（S4）を選んで依頼
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel(); const i4 = pr.options.findIndex((o) => o.startsWith('S4 ')); for (let k = 0; k < i4; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(1200)
const rs = await t.toast(); p = await t.proj(); log('request to S4 →', rs, show(p, K))
check('A5-4 案件の商社が全社辞退した客先指定品を、購買が別の商社（RS）を選んで頼める', p.quotes.some((q) => q.rowId === K && q.supplierId === 'S4' && !q.stale), rs)
// 相見積の行: 採用商社が取扱なしに変わる
await t.role('design'); log('bulk →', await t.bulk())
p = await t.proj(); const A = p.rows.find((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && r.adoptReason !== '指定先（固定）')
log('A', show(p, A.id))
await t.role('purchasing'); await t.press('6'); await t.setCellKey(A.id, `q.leadDays@${A.adoptedSupplierId}`, '取扱なし'); await t.press('Escape')
p = await t.proj(); log('A after adopted supplier declined', show(p, A.id), 'ball', await t.cellText(A.id, 'ball'))
check('A5-5 相見積で採用商社の回答を「取扱なし」に直したら、採用が外れる（または選び直しに回る）', p.rows.find((r) => r.id === A.id).adoptedSupplierId !== A.adoptedSupplierId || p.rows.find((r) => r.id === A.id).status === 'quoted', show(p, A.id))
summary(); await t.close()
