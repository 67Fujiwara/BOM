// k7: 承認 ON で、同じ行に承認待ちの変更セットが 2 つ重なる（Rev.a: A の必要数、Rev.b: A の部品名＋B の部品名）
//   mode=approve: PM が A で y → 2 つの変更セットの扱い（Rev.a も承認済になるか、取り残されて「承認待ち」のままか）
//   mode=reject : PM が A で Shift+Y → A の作業中に両方が戻る。Rev.a・Rev.b の履歴
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel(idx) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); return sheetsOf(n0) }
const subs = (p) => JSON.stringify(p.submissions.filter((s) => s.changeSet).map((s) => [s.rev, s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : 'pend', s.rowIds, s.revoked ? 'revoked' : '']))
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const sel = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, nA = sel[0].name, nB = sel[1].name
log('A', h.show(p, A), 'B', h.show(p, B))
await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('publish cs1 →', await t.publish('1'))
log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')); log('publish cs2 →', await t.publish('3'))
p = await t.proj(); const rA0 = p.rows.find((r) => r.id === A)
log('before PM subs', subs(p), 'A pending', JSON.stringify(rA0.pendingApproval), 'pendingRev', rA0.pendingRev)
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has A,B', v7.includes(A), v7.includes(B))
if (mode === 'approve') {
  const y = await t.yes(A, '承認'); log('PM y A →', y.toast)
  p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  log('after subs', subs(p), 'A', rA.qtyNeeded, rA.name, 'B', rB.name, 'B pmPending', rB.flags.pmPending)
  check('K7-1 A の承認で A の 2 つの変更（必要数・部品名）が反映される', rA.qtyNeeded === qA + 1 && rA.name === 'NAME-A2', `qty=${rA.qtyNeeded} name=${rA.name}`)
  const cs = p.submissions.filter((s) => s.changeSet)
  check('K7-2 承認したあと「承認待ち」のまま残る変更セットの Rev が無い（Rev.a が承認済・決定と結びつく）', cs.every((s) => s.changeSet.approved || s.changeSet.rejected), subs(p))
  await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A)
  log('purch 変更点 A', JSON.stringify(chg))
  check('K7-3 購買の変更点で、A の必要数の Rev（Rev.a）に承認の記録（承認者）が出る', chg.some((r) => /必要数/.test(String(r[7])) && String(r[8] ?? '').trim()), JSON.stringify(chg.map((r) => [r[0], r[7], r[8]])))
} else {
  const dec = await t.decide(A, 'Shift+Y', '客先未確定'); log('PM Shift+Y A →', dec.toast)
  p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  log('after subs', subs(p), 'A', rA.qtyNeeded, rA.name, 'working', JSON.stringify(rA.working ?? null), 'B', rB.name, 'B working', JSON.stringify(rB.working ?? null), 'B pmPending', rB.flags.pmPending)
  check('K7-4 却下で A の公開値は元のまま、2 つの変更（必要数・部品名）が設計の作業中に戻る', rA.qtyNeeded === qA && rA.name === nA && rA.working?.qtyNeeded === qA + 1 && rA.working?.name === 'NAME-A2', `qty=${rA.qtyNeeded} name=${rA.name} working=${JSON.stringify(rA.working)}`)
  const cs = p.submissions.filter((s) => s.changeSet)
  check('K7-5 却下したあと「承認待ち」のまま残る変更セットの Rev が無い（Rev.a も却下）', cs.every((s) => s.changeSet.approved || s.changeSet.rejected), subs(p))
  await t.role('pm'); await t.press('7'); const v7b = await t.viewRows(); log('PM 7 after reject has B', v7b.includes(B))
  log('INFO B（Rev.b のもう 1 行）', rB.name, 'pmPending', rB.flags.pmPending, 'working', JSON.stringify(rB.working ?? null))
}
// 残った Rev.a（R076〜 の追加行も含む変更セット）を PM が承認 → A の変更点・公開値と食い違わないか
{
  const ra = p.submissions.find((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected)
  const other = ra ? ra.rowIds.find((id) => id !== A) : null
  if (other) {
    await t.role('pm'); await t.press('7'); const y2 = await t.yes(other, '追加行を承認'); log('PM y Rev.a via', other, '→', y2.toast)
    p = await t.proj(); const rA = p.rows.find((r) => r.id === A); log('after Rev.a approve subs', subs(p), 'A qty', rA.qtyNeeded, 'name', rA.name, 'working', JSON.stringify(rA.working ?? null))
    await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A)
    log('purch 変更点 A (final)', JSON.stringify(chg.map((r) => [r[0], r[4], r[5], r[7], r[8]])))
    const revA = ra.rev
    const rowRevA = chg.find((r) => r[0] === revA)
    check('K7-6 Rev.a（A の必要数・理由「客先要求」）の決定と A の公開値・変更点が食い違わない（承認済の Rev.a に A の必要数の変更が載るなら公開値も変わっている）', !rowRevA || !/必要数: \d+ → (\d+)/.test(String(rowRevA[7])) || String(rA.qtyNeeded) === String(rowRevA[7]).match(/必要数: \d+ → (\d+)/)[1], JSON.stringify({ rowRevA, qty: rA.qtyNeeded }))
    const row3 = chg.find((r) => r[0] === revA + 1)
    check('K7-7 A の必要数の変更が、別の理由の変更セット（Rev.b）の変更として記録されない', !row3 || !/必要数/.test(String(row3[7])), JSON.stringify(row3 ?? null))
  }
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k7-' + mode)
summary(); await t.close()
