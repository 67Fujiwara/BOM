// a6: 承認 ON で新しい行（変更セット・PM 承認待ち）に、購買が 6 で見積を入れられるか・状態が動くか（§5「承認されるまで購買には『承認待ちの変更あり』だけ」）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80)
const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'changeNeedsPmApproval') })
for (let i = 0; i < idx; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await t.promptFill('承認制'); await t.press('Enter'); await page.waitForTimeout(80)
log('approval ON', (await t.proj()).settings.changeNeedsPmApproval)
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} st=${r.status} pub=${r.publishedRev} adopt=${r.adoptedSupplierId ?? '-'} flags=${JSON.stringify(r.flags)} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
await t.role('design'); await t.press('1')
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
const A = await addRow('R080', '追加リレー', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await addRow(A, '追加指定', 'UK5N', 'フエニックス', '指定商社', '因幡電機')
log('publish →', await t.publish('1'))
let p = await t.proj(); log(show(p, A)); log(show(p, B))
await t.role('purchasing'); await t.press('6')
const vis = await t.viewRows(); log('purch 6 has A/B', vis.includes(A), vis.includes(B), 'cell A name', await t.cellText(A, 'name'))
let r1 = 'n/a'; try { r1 = await t.setCellKey(A, 'q.unitPrice@S1', '1500'); await t.press('Escape'); r1 += ' / ' + await t.setCellKey(A, 'q.leadDays@S1', '5'); await t.press('Escape') } catch (e) { r1 = 'ERR ' + e.message.slice(0, 80) }
let r2 = 'n/a'; try { r2 = await t.setCellKey(B, 'q.unitPrice@S1', '800'); await t.press('Escape'); r2 += ' / ' + await t.setCellKey(B, 'q.leadDays@S1', '5'); await t.press('Escape') } catch (e) { r2 = 'ERR ' + e.message.slice(0, 80) }
p = await t.proj(); log('A entry →', r1, show(p, A)); log('B entry →', r2, show(p, B))
check('A6-1 PM 承認待ちの新しい行に、依頼前に購買が見積を入れても状態が「見積中・選定済」に進まない（または入れられない）', p.rows.find((r) => r.id === A).status === 'submitted' && p.rows.find((r) => r.id === B).status === 'submitted', `${show(p, A)} | ${show(p, B)}`)
await t.shot('a6-pending-rows')
// PM が却下したら
await t.role('pm'); await t.press('7'); await t.goto(A); await t.press('Shift+Y'); await page.waitForTimeout(80); if (await t.panel()) { await t.promptFill('不要'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
p = await t.proj(); log('after PM reject', show(p, A), show(p, B))
summary(); await t.close()
