// b3: 採用した商社が後から「取扱なし」（M8-02 の修正）: 相見積・指定商社・客先指定品 × 選定済 / 正式依頼中 / 正式見積済、納期NG の行、Ctrl+Z
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('purchasing')
let p = await t.proj()
const decline = async (id, sid) => { await t.press('6'); const r = await t.setCellKey(id, `q.leadDays@${sid}`, '取扱なし'); await t.press('Escape'); return r }
const due = (id) => page.evaluate(async (id) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === id); return { due: d.rowDue(p, r), dueAt: r.dueAt ?? null } }, id)

// 1) R003 選定済・納期NG（因幡 24 日）→ 因幡が取扱なし
log('R003 before', h.show(p, 'R003'), 'ball', await h.ballOf('R003'), 'case', await h.caseOf('R003'))
await decline('R003', 'S1'); p = await t.proj()
log('R003 after decline', h.show(p, 'R003'), 'ball', await h.ballOf('R003'), 'case', await h.caseOf('R003'))
const r3 = p.rows.find((r) => r.id === 'R003')
check('B3-1 採用商社の辞退で採用が外れ見積済（相見積・選定済）', r3.status === 'quoted' && !r3.adoptedSupplierId, r3.status)
check('B3-2 採用が外れた行に納期NG が残らず、ボールは選定者（設計）', !r3.flags.leadNG && (await h.ballOf('R003')) === 'design', `leadNG=${r3.flags.leadNG} ball=${await h.ballOf('R003')} case=${await h.caseOf('R003')}`)
log('PM 7 has R003', await h.inView('pm', 7, 'R003'), 'design 4 has R003', await h.inView('design', 4, 'R003'))
await t.role('pm'); await t.press('7'); await t.goto('R003'); await t.press('Enter'); await page.waitForTimeout(80); log('PM Enter on R003', JSON.stringify(await t.panel()), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.shot('b3-r003-pm7')

// 2) R001・R002 を正式依頼 → R001 の因幡が辞退（正式依頼中）
await t.role('purchasing')
log('formal →', await t.requestFormal())
p = await t.proj(); log('R001 formal', h.show(p, 'R001'), JSON.stringify(await due('R001')))
await decline('R001', 'S1'); p = await t.proj()
const r1 = p.rows.find((r) => r.id === 'R001'); const q1 = p.quotes.find((q) => q.rowId === 'R001' && q.supplierId === 'S1' && !q.stale)
log('R001 after decline', h.show(p, 'R001'), 'ball', await h.ballOf('R001'), JSON.stringify(await due('R001')), 'formalNo', q1.formalRequestNo, 'needDate', q1.formalNeedDate)
check('B3-3 正式依頼中で採用商社が辞退 → 見積済・選定者のボール', r1.status === 'quoted' && !r1.adoptedSupplierId && (await h.ballOf('R001')) === 'design', r1.status)
const d1 = await due('R001')
check('B3-4 見積済に戻った行の期限は選定期限（見積済から 2 営業日）で、正式見積の期限が残らない', d1.dueAt == null, JSON.stringify(d1))
await t.press('8'); log('8 has R001', (await t.viewRows()).includes('R001'))
// 設計が選び直す → 正式依頼をもう一度
await t.role('design'); await t.press('4'); await t.goto('R001'); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast())
await t.role('purchasing'); const n0 = t.downloads.length; log('formal again →', await t.requestFormal()); const f2 = await h.files(n0); log('files', JSON.stringify(f2.map((f) => [f.sup, f.ids])))
p = await t.proj(); log('R001 after re-adopt', h.show(p, 'R001'))

// 3) R013 正式見積済 → 因幡が辞退
log('R013 before', h.show(p, 'R013'))
await decline('R013', 'S1'); p = await t.proj(); const r13 = p.rows.find((r) => r.id === 'R013')
log('R013 after', h.show(p, 'R013'), 'ball', await h.ballOf('R013'), JSON.stringify(await due('R013')))
check('B3-5 正式見積済で採用商社が辞退 → 見積済に戻り、正式単価が消える', r13.status === 'quoted' && !r13.adoptedSupplierId, r13.status)

// 4) R045 指定商社（立花）→ 正式依頼中で立花が辞退 → 設計が指定先を変える → 公開 → 購買の依頼
log('R045 before', h.show(p, 'R045'))
await decline('R045', 'S2'); p = await t.proj(); log('R045 after', h.show(p, 'R045'), 'ball', await h.ballOf('R045'))
const r45 = p.rows.find((r) => r.id === 'R045')
check('B3-6 指定商社の指定先が採用後に辞退 → 見積中・設計のボール', r45.status === 'quoting' && !r45.adoptedSupplierId && (await h.ballOf('R045')) === 'design', r45.status)
await t.role('design'); await t.press('4'); log('design 4 has R045', (await t.viewRows()).includes('R045'))
await t.goto('R045'); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); log('Ctrl+.', JSON.stringify(qf?.options))
if (qf) {
  const i = qf.options.findIndex((o) => o.includes('指定先を変える')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  const pr = await t.panel(); log('candidates', JSON.stringify(pr?.options)); await t.press('Enter'); await page.waitForTimeout(80); log('→', await t.toast())
  log('publish →', await t.publish('1'))
}
await t.role('purchasing'); const rq = await h.requestTo(null); p = await t.proj(); log('request →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes('R045')])), h.show(p, 'R045'))
const newSid = p.rows.find((r) => r.id === 'R045').designated
await t.press('6'); await h.q('R045', newSid, 9000, 10); p = await t.proj(); log('R045 new answer', h.show(p, 'R045'))
check('B3-7 新しい指定先の回答で「指定先（固定）」採用', p.rows.find((r) => r.id === 'R045').adoptedSupplierId === newSid, h.show(p, 'R045'))

// 5) R034 客先指定品（因幡）→ 選定済で辞退 → 次の商社
await decline('R034', 'S1'); p = await t.proj(); log('R034 after', h.show(p, 'R034'), 'ball', await h.ballOf('R034'))
await t.press('4'); await t.goto('R034'); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf2 = await t.panel(); log('R034 Ctrl+.', JSON.stringify(qf2?.options)); if (qf2) await t.press('Escape')
check('B3-8 客先指定品の採用後の辞退 → 見積中・次の商社の案内', p.rows.find((r) => r.id === 'R034').status === 'quoting' && !!qf2, '')

// 6) R002 選定済 → 辞退 → Ctrl+Z
p = await t.proj(); log('R002 before', h.show(p, 'R002'))
await decline('R002', 'S1'); p = await t.proj(); log('R002 after decline', h.show(p, 'R002'))
await t.press('Control+z'); await page.waitForTimeout(100); p = await t.proj(); log('R002 after Ctrl+Z', h.show(p, 'R002'), await t.toast())
const r2 = p.rows.find((r) => r.id === 'R002')
check('B3-9 辞退の入力を Ctrl+Z で戻すと採用も戻る', r2.adoptedSupplierId === 'S1' && ['selected', 'formalRequested'].includes(r2.status), h.show(p, 'R002'))
summary(); await t.close()
