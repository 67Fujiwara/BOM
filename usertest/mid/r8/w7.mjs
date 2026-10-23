// w7: 集約の手計算、PM ボールの行の取込不一致、案件納期変更後の 5（役割ごとの確認）、ヘッダーの内訳
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// --- 集約の手計算（実質単価はアプリの scoreRow を使い、対象行・合計は自分で）
const calc = await page.evaluate(async () => {
  const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project()
  const rows = p.rows.filter((r) => ['quoted', 'selected'].includes(r.status) && !['支給品', '社内在庫'].includes(r.procurement) && !(r.working && Object.keys(r.working).length) && !r.flags.pmPending)
  const per = Object.fromEntries(rows.map((r) => [r.id, sc.scoreRow(p, r, s.ws.suppliers).map((x) => ({ s: x.supplierId, ep: x.effectivePrice }))]))
  const cur = (r) => { const a = r.adoptedSupplierId ? per[r.id].find((x) => x.s === r.adoptedSupplierId) : per[r.id][0]; return a ? a.ep * r.qtyNeeded : 0 }
  const current = rows.reduce((t, r) => t + cur(r), 0)
  const combos = [['S1'], ['S2'], ['S3'], ['S1', 'S2'], ['S1', 'S3'], ['S2', 'S3']]
  return { n: rows.length, current: Math.round(current), res: combos.map((ids) => { let tot = 0, cov = 0; for (const r of rows) { const c = per[r.id].filter((x) => ids.includes(x.s)); if (!c.length) { tot += cur(r); continue } cov++; tot += Math.min(...c.map((x) => x.ep)) * r.qtyNeeded } return `${ids.join('+')}: ${cov}/${rows.length} ¥${Math.round(tot).toLocaleString()} 差 ${Math.round(tot - current).toLocaleString()}` }) }
})
log('hand consolidation', JSON.stringify(calc, null, 0))
await t.cmd('商社を集約'); await page.waitForTimeout(150); const opts = (await t.panel())?.options ?? []; log('app consolidation', JSON.stringify(opts)); await t.press('Escape')
const appTop = opts.find((o) => o.startsWith('因幡電機 + 立花エレテック')); const handTop = calc.res.find((x) => x.startsWith('S1+S2'))
check('W7-1 集約の試算（因幡＋立花）が手計算と一致', appTop && handTop && appTop.includes(handTop.split(' ')[2]) && appTop.includes(handTop.split(' ')[1]), `${appTop} | ${handTop}`)
// --- ヘッダーの内訳
const lamps = await t.lamps(); const m = lamps.match(/設計待ち (\d+)（指摘 (\d+)・選定待ち (\d+)）/); log('lamps', lamps)
log('header breakdown sum', m ? `${m[1]} vs ${+m[2] + +m[3]}` : 'n/a')
// --- PM ボール（納期NG）の行に型式違いの回答
await t.role('purchasing'); log('ball R003', await t.cellText('R003', 'ball'), JSON.stringify((await t.row('R003')).flags))
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(80)
await page.getByTestId('import-text').fill(['行ID\t型式\t単価\t納期', 'R003\tCP30-XX\t5000\t5'].join('\n')); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(150); log('import →', await t.toast())
await t.press('4'); const v4 = await t.viewRows(); log('purchasing 4', v4.join(','), 'R003 ball', await t.cellText('R003', 'ball'), JSON.stringify((await t.row('R003')).flags))
check('W7-2 型式不一致の行は、ボールが PM（納期NG）でも購買の 4 に出る（§11）', v4.includes('R003'), v4.join(','))
// --- 案件納期変更 → 5（設計が確認しても購買の 5 に残る）
await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80); await t.press('ArrowDown'); await t.press('Enter')
const p0 = await t.proj(); await page.getByTestId('settings-input').fill(new Date(new Date(p0.dueDate).getTime() + 7 * 86400e3).toISOString().slice(0, 10)); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(150)
await t.press('Enter'); await page.waitForTimeout(60); await t.promptFill('客先都合'); await t.press('Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
await t.role('design'); await t.press('5'); const d5 = await t.viewRows(); log('design 5 count', d5.length, 'R020 cause', await t.cellText('R020', 'cause'))
await t.goto('R020'); await t.press('x'); await page.waitForTimeout(60); log('design x →', await t.toast())
await t.role('purchasing'); await t.press('5'); const p5 = await t.viewRows(); log('purchasing 5 has R020', p5.includes('R020'), 'cause', await t.cellText('R020', 'cause'))
await t.role('design'); await t.press('5'); const d5b = await t.viewRows(); log('design 5 has R020 after x', d5b.includes('R020'))
check('W7-3 5 の確認は役割ごと（設計の x で購買の 5 から消えない）', p5.includes('R020') && !d5b.includes('R020'))
summary(); await t.close()
