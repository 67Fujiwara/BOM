// l2: 承認 ON で同じ行に承認待ちの変更セットが 2 つ重なる（M17-03 の修正「前の Rev を Rev n にまとめた」）
//   追加行（R076〜）を先に公開しておき、Rev.a は A の必要数だけ（理由「客先要求」）、Rev.b は A・B の部品名（「廃番・入手難」）
//   mode=approve: PM が A で y → A の必要数・部品名が公開値、Rev.a は「Rev.b にまとめた」、変更点・差分シート
//   mode=reject : PM が A で Shift+Y → 両方の変更が作業中に戻る、Rev.a は承認待ちで残らない → 設計が出し直して承認
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel(idx) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); return sheetsOf(n0) }
const subs = (p) => JSON.stringify(p.submissions.filter((s) => s.changeSet).map((s) => [s.rev, s.changeSet.reason, s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : s.changeSet.supersededBy != null ? 'merged→' + s.changeSet.supersededBy : 'pend', s.rowIds.join(','), s.revoked ? 'revoked' : '']))
await t.open('design')
log('publish drafts first →', await t.publish('1'))
await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const sel = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, nA = sel[0].name, nB = sel[1].name
log('A', h.show(p, A), 'B', h.show(p, B))
await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('publish cs-a →', await t.publish('1'))
p = await t.proj(); const revA = p.submissions.at(-1).rev; log('after cs-a', subs(p))
log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')); log('publish cs-b →', await t.publish('3'))
p = await t.proj(); const revB = p.submissions.at(-1).rev; const rA0 = p.rows.find((r) => r.id === A)
log('before PM subs', subs(p), 'A pending', JSON.stringify(rA0.pendingApproval), 'pendingRev', rA0.pendingRev)
const sa = p.submissions.find((s) => s.rev === revA)
check('L2-1 Rev.a（A だけ）は Rev.b にまとめた印になり、承認待ちのまま残らない（M17-03）', sa.changeSet.supersededBy === revB, subs(p))
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 rows', JSON.stringify(v7.filter((x) => /^R/.test(x))))
await t.goto(A); await t.press('Home'); const sbA = (await t.status()).slice(0, 300); log('PM statusbar A', sbA)
await t.press('Enter'); await page.waitForTimeout(100); const pan = await t.panel(); await t.press('Escape'); await t.press('Escape')
log('PM decide panel A', JSON.stringify(pan))
const panelText = JSON.stringify(pan) + sbA
check('L2-2 PM が A を決めるときに、まとめた Rev.a の変更（必要数 ' + qA + ' → ' + (qA + 1) + '・理由「客先要求」）が見える', /qtyNeeded|必要数/.test(panelText) && new RegExp(String(qA + 1)).test(panelText), panelText.slice(0, 400))
if (mode === 'partial') {
  // ここまでの Rev.a は A だけ。部分的に重なる形を別に作る: C・D の必要数（Rev.c）→ C の部品名だけ（Rev.d）
  const C = sel[2].id, D = sel[3].id, qC = sel[2].qtyNeeded, qD = sel[3].qtyNeeded
  await t.role('pm'); await t.press('7'); log('PM y A (Rev.b) →', (await t.yes(A, 'ok')).toast)
  await t.role('design'); await t.press('1'); log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish cs-c →', await t.publish('1'))
  p = await t.proj(); const revC = p.submissions.at(-1).rev
  log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish cs-d →', await t.publish('3'))
  p = await t.proj(); const revD = p.submissions.at(-1).rev; log('subs', subs(p), 'C pendingRev', p.rows.find((r) => r.id === C).pendingRev, 'D pendingRev', p.rows.find((r) => r.id === D).pendingRev)
  await t.role('pm'); await t.press('7'); log('PM y D (Rev.c) →', (await t.yes(D, '必要数の変更を承認')).toast)
  p = await t.proj(); let rC = p.rows.find((r) => r.id === C), rD = p.rows.find((r) => r.id === D)
  log('after Rev.c approve', subs(p), 'C qty', rC.qtyNeeded, 'D qty', rD.qtyNeeded, 'C pendingRev', rC.pendingRev)
  check('L2P-1 Rev.c（C・D の必要数）を承認したら、Rev.c に載っている C の必要数も公開値になる（または Rev.c の決定が C の分を含まないと分かる）', rC.qtyNeeded === qC + 1, `C qty=${rC.qtyNeeded} (want ${qC + 1}) pendingRev=${rC.pendingRev} subs=${subs(p)}`)
  log('PM Shift+Y C (Rev.d) →', (await t.decide(C, 'Shift+Y', '部品名は不可')).toast)
  p = await t.proj(); rC = p.rows.find((r) => r.id === C)
  log('after Rev.d reject', subs(p), 'C qty', rC.qtyNeeded, 'name', rC.name, 'working', JSON.stringify(rC.working ?? null))
  check('L2P-2 Rev.d（C の部品名）を却下しても、承認済の Rev.c の C の必要数は戻らない', rC.qtyNeeded === qC + 1, `C qty=${rC.qtyNeeded} working=${JSON.stringify(rC.working)}`)
  const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === C)
  log('PM 変更点 C', JSON.stringify(chg.map((r) => [r[0], r[5], r[7], r[8]])))
  const rc = chg.find((r) => r[0] === revC)
  check('L2P-3 変更点で「承認」とある Rev.c の C の必要数の変更と、C の公開値が食い違わない', !rc || !/必要数: \d+ → (\d+)/.test(String(rc[7])) || String(rC.qtyNeeded) === String(rc[7]).match(/必要数: \d+ → (\d+)/)[1], JSON.stringify({ rc: rc && [rc[7], rc[8]], qty: rC.qtyNeeded }))
} else if (mode === 'approve') {
  const y = await t.yes(A, '承認'); log('PM y A →', y.toast)
  p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  log('after subs', subs(p), 'A', rA.qtyNeeded, rA.name, 'B', rB.name, 'B pm', rB.flags.pmPending)
  check('L2-3 承認で A の必要数・部品名、B の部品名が公開値に', rA.qtyNeeded === qA + 1 && rA.name === 'NAME-A2' && rB.name === 'NAME-B2', `A ${rA.qtyNeeded} ${rA.name} B ${rB.name}`)
  check('L2-4 承認待ちのまま残る変更セットが無い', p.submissions.filter((s) => s.changeSet).every((s) => s.changeSet.approved || s.changeSet.rejected || s.changeSet.supersededBy != null), subs(p))
  await t.role('purchasing'); const ex0 = await excel(0); log('purch 変更点 A', JSON.stringify(ex0.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A).map((r) => [r[0], r[4], r[5], r[7], r[8]])))
  await t.role('pm'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A)
  log('PM 変更点 A', JSON.stringify(chg.map((r) => [r[0], r[4], r[5], r[7], r[8]])))
  const ra = chg.find((r) => r[0] === revA), rb = chg.find((r) => r[0] === revB)
  check('L2-5 変更点（PM の社内）：Rev.a は「Rev.b にまとめた」、Rev.b は承認者つき、A の必要数と部品名の変更がどちらかに出る', /まとめた/.test(String(ra?.[8] ?? '')) && String(rb?.[8] ?? '').trim() && !/まとめた|却下/.test(String(rb?.[8])) && /必要数/.test(String(ra?.[7]) + String(rb?.[7])) && /部品名/.test(String(rb?.[7])), JSON.stringify({ ra: ra && [ra[7], ra[8]], rb: rb && [rb[7], rb[8]] }))
  // 正式見積の依頼（A は必要数が承認で変わった → 依頼書の発注数）
  await t.role('purchasing'); await t.press('9'); const n0 = t.downloads.length; log('formal →', await t.requestFormal())
  const rowsA = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === A) rowsA.push(v.slice(0, 6)) }) }
  log('formal A', JSON.stringify(rowsA))
  check('L2-5b 変更点：A の必要数の変更が、その変更の理由「客先要求」で記録される（別の理由の Rev.b の変更として承認記録に載らない）', chg.filter((r) => /必要数/.test(String(r[7]))).every((r) => r[5] === '客先要求'), JSON.stringify(chg.filter((r) => /必要数/.test(String(r[7]))).map((r) => [r[0], r[5], r[7]])))
  check('L2-6 承認した必要数で A の正式見積の依頼書が出る（部品名 NAME-A2）', rowsA.some((r) => r[1] === 'NAME-A2'), JSON.stringify(rowsA))
} else {
  const dec = await t.decide(A, 'Shift+Y', '客先未確定'); log('PM Shift+Y A →', dec.toast)
  p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  log('after subs', subs(p), 'A', rA.qtyNeeded, rA.name, 'working', JSON.stringify(rA.working ?? null), 'B', rB.name, 'B working', JSON.stringify(rB.working ?? null))
  check('L2-3r 却下で A の公開値は元のまま、2 つの変更が作業中に戻る', rA.qtyNeeded === qA && rA.name === nA && rA.working?.qtyNeeded === qA + 1 && rA.working?.name === 'NAME-A2', `A ${rA.qtyNeeded} ${rA.name} w=${JSON.stringify(rA.working)}`)
  check('L2-4r 承認待ちのまま残る変更セットが無い（Rev.a はまとめた、Rev.b は却下）', p.submissions.filter((s) => s.changeSet).every((s) => s.changeSet.approved || s.changeSet.rejected || s.changeSet.supersededBy != null), subs(p))
  await t.role('pm'); await t.press('7'); const v7b = await t.viewRows(); log('PM 7 after reject has A/B', v7b.includes(A), v7b.includes(B))
  // 設計が必要数だけ出し直す（部品名は戻す）
  await t.role('design'); await t.press('1'); log('A name back →', await t.setCellKey(A, 'name', nA)); log('B name back →', await t.setCellKey(B, 'name', nB))
  log('publish cs-c →', await t.publish('1'))
  p = await t.proj(); const revC = p.submissions.at(-1).rev; log('after cs-c', subs(p), 'A pending', JSON.stringify(p.rows.find((r) => r.id === A).pendingApproval ?? null))
  await t.role('pm'); await t.press('7'); log('PM y A (cs-c) →', (await t.yes(A, '必要数だけ承認')).toast)
  p = await t.proj(); const rA2 = p.rows.find((r) => r.id === A)
  log('final', subs(p), 'A', rA2.qtyNeeded, rA2.name, 'working', JSON.stringify(rA2.working ?? null))
  check('L2-5r 出し直した必要数の変更セットを承認すると A の必要数だけ変わる', rA2.qtyNeeded === qA + 1 && rA2.name === nA, `A ${rA2.qtyNeeded} ${rA2.name}`)
  await t.role('purchasing'); const ex0 = await excel(0); log('purch 変更点 A', JSON.stringify(ex0.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A).map((r) => [r[0], r[4], r[5], r[7], r[8]])))
  await t.role('pm'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A)
  log('PM 変更点 A', JSON.stringify(chg.map((r) => [r[0], r[4], r[5], r[7], r[8]])))
  const ra = chg.find((r) => r[0] === revA), rb = chg.find((r) => r[0] === revB), rc = chg.find((r) => r[0] === revC)
  check('L2-6r 変更点（PM の社内）：却下のあと出し直した Rev.c の内容は、承認で実際に変わった必要数（' + qA + ' → ' + (qA + 1) + '）。却下した Rev.b の値と比べた「部品名 NAME-A2 → 元の名前」にならない', /まとめた/.test(String(ra?.[8] ?? '')) && /却下/.test(String(rb?.[8] ?? '')) && /必要数/.test(String(rc?.[7])) && !/部品名/.test(String(rc?.[7])) && String(rc?.[8] ?? '').trim() && !/却下|まとめた/.test(String(rc?.[8])), JSON.stringify({ ra: ra && [ra[7], ra[8]], rb: rb && [rb[7], rb[8]], rc: rc && [rc[7], rc[8]] }))
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l2-' + mode)
summary(); await t.close()
