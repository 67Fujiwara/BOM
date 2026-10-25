// a7: 商社を 1 社だけ選んだ依頼の結果の文（「全社に依頼」と書かないか）、客先指定品の全社辞退 → 案件設定で相見積先に RS を足すと進めるか
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const U = await addRow('R080', '未登録メーカ', 'TS-35', 'ワイドミュラー', '相見積')
const K = await addRow(U, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
log('publish →', await t.publish('1'))
await t.role('purchasing')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); let pr = await t.panel(); let i = pr.options.findIndex((o) => o.startsWith('S2 ')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(1300)
const m1 = await t.toast(); let p = await t.proj(); log('request only S2 →', m1); log(show(p, U)); log(show(p, K))
check('A7-1 1 社だけ選んだ依頼で、結果に「全社に依頼」と出ない（実際は 1 社）', !/全社に依頼/.test(m1) || p.quotes.filter((q) => q.rowId === U && !q.stale).length === 3, m1)
// 残りの商社にも依頼
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1300); log('request all →', await t.toast()); p = await t.proj(); log(show(p, U)); log(show(p, K))
// K を全社辞退させる
for (let n = 0; n < 3; n++) {
  p = await t.proj(); const cur = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1)[0]
  if (!cur) { const r = await t.requestRough(); log('next request', r); continue }
  await t.press('6'); await t.setCellKey(K, `q.leadDays@${cur.supplierId}`, '取扱なし'); await t.press('Escape'); log('declined by', cur.supplierId)
  p = await t.proj(); if (!p.quotes.some((q) => q.rowId === K && !q.stale && q.leadDays !== -1)) { const r = await t.requestRough(); log('next request', r) }
}
p = await t.proj(); log('K', show(p, K))
// 案件設定（購買項目）の相見積先に S4 を足す
await t.cmd('案件設定'); await page.waitForTimeout(80)
const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'supplierIds') })
for (let k = 0; k < idx; k++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('S1,S2,S3,S4'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); if (await t.panel()) { try { await t.promptFill('客先指定品の依頼先') } catch {} ; await t.press('Enter'); await page.waitForTimeout(80) }
p = await t.proj(); log('supplierIds', JSON.stringify(p.supplierIds), await t.toast())
await t.press('4'); await t.goto(K); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); log('Ctrl+. after adding S4', JSON.stringify(qf?.options)); if (qf) await t.press('Escape')
const r4 = await t.requestRough(); p = await t.proj(); log('request →', r4, show(p, K))
check('A7-2 相見積先に RS を足せば、全社辞退の客先指定品を RS に頼める（回り道はある）', p.quotes.some((q) => q.rowId === K && q.supplierId === 'S4' && !q.stale), r4)
summary(); await t.close()
