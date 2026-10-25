// d2: 辞退の後始末の残り（PM の判断のあとで採用商社が辞退）
// fail: 納期NG → PM d → 設計「代替なし」（対策不成立で PM の 7）→ 採用商社が辞退
// q: 正式見積の差分超過 → PM q（数量見直し依頼）→ 採用商社が辞退 → 設計「数量変更不可」
// g: 正式見積の差分超過 → PM g（再交渉）→ 採用商社が辞退
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'fail'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.by.role]))
async function designNoAlt(id, label) {
  await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  const pn = await t.panel(); log('issue panel', JSON.stringify(pn?.options))
  if (!pn?.options?.some((o) => o.startsWith('7'))) { await t.press('Escape'); await t.press('Escape'); return false }
  await t.press('7'); await page.waitForTimeout(80); await t.promptFill(label); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape'); return true
}
let X
if (mode === 'fail') {
  X = p.rows.find((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested && r.procurement === '相見積').id
  await t.role('pm'); await t.press('7'); log('PM d →', (await t.decide(X, 'd', '代替を')).toast)
  await designNoAlt(X, '代替なし')
  p = await t.proj(); log('X 対策不成立', h.show(p, X), iss(p, X), 'case', await h.caseOf(X))
} else {
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  p = await t.proj()
  const lateIds = await page.evaluate(async () => { const d = await import(window.__m('/src/model/derive.ts')); const dt = await import(window.__m('/src/model/dates.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => { const need = d.rowNeedDate(p, r); return need && p.quotes.some((q) => q.rowId === r.id && !q.stale && q.supplierId !== r.adoptedSupplierId && q.unitPrice != null && q.leadDays > 0 && q.stock !== '在庫' && dt.addDays(dt.todayStr(), q.leadDays) > need) }).map((r) => r.id) })
  X = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && (mode !== 'g' || lateIds.includes(r.id)) && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
  const rX = p.rows.find((r) => r.id === X); const qX = p.quotes.find((q) => q.rowId === X && q.supplierId === rX.adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(Math.round(qX.unitPrice * 1.5) + 20000)); await t.press('Escape'); await t.press('Escape')
  p = await t.proj(); log('X diff', h.show(p, X), 'case', await h.caseOf(X))
  await t.role('pm'); await t.press('7'); log(`PM ${mode} →`, (await t.decide(X, mode, mode === 'g' ? '価格を再交渉' : '')).toast)
  p = await t.proj(); log('X after PM', h.show(p, X), iss(p, X), 'case', await h.caseOf(X))
}
const adopted = p.rows.find((r) => r.id === X).adoptedSupplierId
await t.role('purchasing'); log('decline →', await h.decline(X, adopted))
p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
log('X after decline', h.show(p, X), iss(p, X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X), 'renegotiating', rX.flags.renegotiating)
if (mode === 'fail') {
  const in7 = await h.pm7Has(X); await t.role('pm'); await t.press('7'); const in7pm = (await t.viewRows()).includes(X)
  if (in7pm) { await t.goto(X); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel', JSON.stringify(await t.panel())); await t.press('Escape') }
  if (in7pm && process.argv[3] === 'b') { log('PM b →', (await t.decide(X, 'b', '')).toast); const p3 = await t.proj(); log('X after b', h.show(p3, X), '|', await h.status(X), 'ball', await h.ballOf(X)); await t.role('design'); await t.press('1'); await t.goto(X); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast()) }
  check('D2-1 対策不成立で PM の 7 に載った行で採用商社が辞退したら、採用の無い行を対策不成立のまま PM に残さない（選定者に戻す）', !in7pm && !rX.flags.pmPending, `in7=${in7pm} ${h.show(p, X)}`)
} else if (mode === 'q') {
  const openQ = p.issues.filter((i) => i.rowId === X && i.kind === '数量見直し依頼' && ['open', 'inProgress'].includes(i.status))
  log('open 数量見直し', JSON.stringify(openQ.map((i) => i.id)))
  const answered = await designNoAlt(X, '減らせない')
  p = await t.proj(); log('X after 数量変更不可', h.show(p, X), iss(p, X), 'case', await h.caseOf(X))
  await t.role('pm'); await t.press('7'); const in7pm = (await t.viewRows()).includes(X)
  if (in7pm) { await t.goto(X); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel', JSON.stringify(await t.panel())); await t.press('Escape') }
  check('D2-2 差分超過への数量見直し依頼のあとで採用商社が辞退したら、採用の無い行が「数量変更不可」で対策不成立として PM の 7 に載らない', !in7pm, `answered=${answered} in7=${in7pm}`)
} else {
  check('D2-3 再交渉中に採用商社が辞退したら、再交渉の印を外し（選び直し）、正式依頼中・PM の 7 に残さない', !rX.flags.renegotiating && !['formalRequested'].includes(rX.status), h.show(p, X) + ' reneg=' + rX.flags.renegotiating)
  await t.role('purchasing'); await t.press('8'); log('purch 8 has X', (await t.viewRows()).includes(X))
  // 選び直し: 必要日に間に合わない商社を選ぶ → 正式見積を依頼 → 納期NG が出るか
  const lateSid = await page.evaluate(async (X) => { const d = await import(window.__m('/src/model/derive.ts')); const dt = await import(window.__m('/src/model/dates.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === X); const need = d.rowNeedDate(p, r); return p.quotes.find((q) => q.rowId === X && !q.stale && q.unitPrice != null && q.leadDays > 0 && dt.addDays(dt.todayStr(), q.leadDays) > need)?.supplierId }, X)
  await t.role('design'); await t.press('1')
  const idx = Number(lateSid.slice(1)) - 1
  log('late sid', lateSid, 'idx', idx); const res = await h.adoptPick(X, 2, '6', '辞退のため'); log('adopt panel', JSON.stringify(res.adoptPanel).slice(0, 300), 'adopt →', res.toast)
  p = await t.proj(); log('X after reselect', h.show(p, X), 'reneg', p.rows.find((r) => r.id === X).flags.renegotiating, 'case', await h.caseOf(X))
  if (p.rows.find((r) => r.id === X).flags.pmPending) { await t.role('pm'); log('PM y →', (await t.yes(X, '承認')).toast) }
  p = await t.proj(); log('X selected', h.show(p, X), 'leadNG', p.rows.find((r) => r.id === X).flags.leadNG)
  await t.role('pm'); await t.press('7'); const pmCase0 = await h.caseOf(X); if (pmCase0 === '納期NG') { log('PM Shift+Y? skip') }
  await t.role('purchasing'); log('formal again →', await t.requestFormal())
  p = await t.proj(); const rr = p.rows.find((r) => r.id === X); log('X after formal', h.show(p, X), 'reneg', rr.flags.renegotiating, 'leadNG', rr.flags.leadNG)
  check('D2-4 選び直した間に合わない商社へ正式見積を依頼したら、正式依頼中でも納期NG が出る（前の再交渉の印で隠れない）', rr.status !== 'formalRequested' || rr.flags.leadNG === true, h.show(p, X))
}
summary(); await t.close()
