// y1b: 案件外の指定先（オムロン直販）の回答の入れ方: 取込の商社の選択肢、S5 を選んで依頼したときの副作用
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const a = await addRow('R080', '直販指定リレー', 'G3NA-210B', 'オムロン', '指定商社', 'オムロン直販')
log('publish →', await t.publish('1'))
await t.role('purchasing')
log('all →', await t.requestRough())
let p = await t.proj(); log('a quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === a)), 'sups', p.supplierIds)
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(100); const pr = await t.panel(); log('import supplier options', JSON.stringify(pr?.options)); await t.press('Escape')
check('Y1b-1 取込の商社の選択肢にオムロン直販がある（依頼書を出した商社）', (pr?.options ?? []).some((o) => o.includes('オムロン直販')))
await t.press('1'); const cols1 = await page.evaluate(async () => { const m = await import(window.__m('/src/model/selectors.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.buildViewModel(s).columns.filter((c) => /S5/.test(c)) }); log('view1 S5 cols', JSON.stringify(cols1))
await t.goto(a); await t.press(' '); await page.waitForTimeout(80); log('detail a', (await page.getByTestId('detail').textContent()).slice(0, 250)); await t.press(' ')
// 回避: 依頼先に S5 を選んで依頼（新しい行で）
await t.role('design'); await t.press('1')
const a2 = await addRow(a, '直販指定リレー2', 'G3NA-220B', 'オムロン', '指定商社', 'オムロン直販')
const z = await addRow(a2, '相見積の端子', 'UT 4', 'フエニックス', '相見積', '')
log('publish →', await t.publish('1'))
await t.role('purchasing')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); let pr2 = await t.panel(); const i5 = pr2.options.findIndex((o) => o.startsWith('S5 ')); for (let k = 0; k < i5; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(1200); log('S5 only →', await t.toast())
p = await t.proj(); log('sups after S5 request', p.supplierIds, 'z', p.rows.find((r) => r.id === z).status)
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); pr2 = await t.panel(); log('options now', JSON.stringify(pr2.options)); await t.press('Enter'); await page.waitForTimeout(1200); log('all →', await t.toast())
p = await t.proj(); log('z quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === z && !q.stale).map((q) => q.supplierId)))
check('Y1b-2 直販を選んで依頼しても、相見積の行（フエニックス）の依頼先に直販（オムロンのみ扱い）が勝手に加わらない', !p.quotes.some((q) => q.rowId === z && q.supplierId === 'S5'), JSON.stringify(p.quotes.filter((q) => q.rowId === z && !q.stale).map((q) => q.supplierId)))
summary(); await t.close()
