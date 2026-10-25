// m1: 承認 ON。前の変更セット（Rev.c＝C・D の必要数）の一部の行（C）だけを、あとの変更セット（Rev.d＝C の部品名）にまとめる（M17-03 の残りの修正）
//   mode=cfirst : Rev.c を D で承認 → C は変わらず Rev.d 待ち → Rev.d を C で承認 → C の必要数・部品名
//   mode=dfirst : Rev.d を C で先に承認 → Rev.c を D で承認
//   mode=dreject: Rev.c を承認 → Rev.d を却下（C の必要数・部品名が作業中に戻る）→ 必要数だけ出し直し（Rev.e）→ 承認
//   mode=crej   : Rev.c を D で却下（C はまとめたので影響しない）→ Rev.d を承認
//   mode=chain  : Rev.c＝C・D の必要数、Rev.d＝C の部品名、Rev.e＝C の部品名をもう一度 → 決定パネル・変更点
//   3 役割の社内 Excel の変更点（まとめた・承認・却下・内容）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
const mode = process.argv[2] ?? 'cfirst'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded, nC = sel[0].name
log('C', C, qC, nC, 'D', D, qD)
await t.press('1')
log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
let p = await t.proj(); const revC = p.submissions.at(-1).rev
log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish Rev.d →', await t.publish('3'))
p = await t.proj(); const revD = p.submissions.at(-1).rev
let revE = null
if (mode === 'chain') { log('C name again →', await t.setCellKey(C, 'name', 'NAME-C3')); log('publish Rev.e →', await t.publish('6')); p = await t.proj(); revE = p.submissions.at(-1).rev }
const last = revE ?? revD
log('subs', c.subs(p), 'C pendingRev', c.row(p, C).pendingRev, 'pa', JSON.stringify(c.row(p, C).pendingApproval), 'D pendingRev', c.row(p, D).pendingRev)
const sc = p.submissions.find((s) => s.rev === revC)
check('M1-0 Rev.c に C を Rev.' + revD + ' にまとめた印（merged）、Rev.c 自体は D が残るので承認待ち', sc.changeSet.merged?.[C] === revD && sc.changeSet.supersededBy == null && c.row(p, C).pendingRev === last && c.row(p, D).pendingRev === revC, c.subs(p))
const panC = await c.panelOf(C); const panD = await c.panelOf(D)
log('panel C', JSON.stringify(panC?.title), JSON.stringify(panC?.options)); log('panel D', JSON.stringify(panD?.title), JSON.stringify(panD?.options))
if (mode === 'chain') {
  check(`M1-9 決定パネル C：Rev.${revE} に、まとめた Rev.${revC}（必要数）と Rev.${revD}（部品名）の両方が出る`, new RegExp(`Rev\\.${revE}`).test(panC?.title) && new RegExp(`${revC}`).test(panC?.title.replace(`Rev.${revE}`, '')) && new RegExp(`${revD}`).test(panC?.title.replace(`Rev.${revE}`, '')), panC?.title)
} else {
  check(`M1-1 決定パネル C：Rev.${revD}（Rev.${revC} の変更をまとめた）、D：Rev.${revC}（まとめた表示なし）`, new RegExp(`Rev\\.${revD}（Rev\\.${revC} の変更をまとめた）`).test(panC?.title) && new RegExp(`Rev\\.${revC}`).test(panD?.title) && !/まとめた/.test(panD?.title), [panC?.title, panD?.title])
}
await t.role('pm'); await t.press('7')
const v7 = await t.viewRows(); log('PM 7 has C,D', v7.includes(C), v7.includes(D))
async function approveD() { const y = await t.yes(D, 'Rev.c 承認'); log('PM y D →', y.toast); return y }
async function approveC(rev) { const y = await t.yes(C, 'Rev.d 承認'); log('PM y C →', y.toast); return y }
const exp = {} // 期待する変更点 { rev: { C: [内容の正規表現, 承認の正規表現], D: … } }
if (mode === 'cfirst' || mode === 'chain') {
  await approveD(); p = await t.proj()
  log('after Rev.c', c.subs(p), 'C', c.row(p, C).qtyNeeded, c.row(p, C).name, 'D', c.row(p, D).qtyNeeded)
  check('M1-2 Rev.c の承認で D の必要数が公開値、C は変わらず（Rev.' + last + ' の承認待ちのまま PM の 7 に残る）', c.row(p, D).qtyNeeded === qD + 1 && c.row(p, C).qtyNeeded === qC && c.row(p, C).flags.pmPending && c.row(p, C).pendingRev === last, `${h.show(p, C)} pendingRev=${c.row(p, C).pendingRev} D=${c.row(p, D).qtyNeeded}`)
  await t.role('pm'); await t.press('7'); await approveC(); p = await t.proj()
  const nm = mode === 'chain' ? 'NAME-C3' : 'NAME-C2'
  check('M1-3 Rev.' + last + ' の承認で C の必要数（Rev.c から）と部品名が公開値に', c.row(p, C).qtyNeeded === qC + 1 && c.row(p, C).name === nm && !c.row(p, C).flags.pmPending, `${c.row(p, C).qtyNeeded} ${c.row(p, C).name}`)
  exp[revC] = { C: [null, /まとめた/], D: [new RegExp(`必要数: ${qD} → ${qD + 1}`), /鈴木|PM|\d{4}-/] }
  exp[last] = { C: [new RegExp(`必要数: ${qC} → ${qC + 1}.*部品名: ${nC} → ${nm}`), /\d{4}-\d\d-\d\d/] }
  if (mode === 'chain') exp[revD] = { C: [null, new RegExp(`まとめた`)] }
} else if (mode === 'dfirst') {
  await approveC(); p = await t.proj()
  check('M1-2d Rev.d の承認で C の必要数（Rev.c から）と部品名が公開値、D は Rev.c の承認待ちのまま', c.row(p, C).qtyNeeded === qC + 1 && c.row(p, C).name === 'NAME-C2' && c.row(p, D).qtyNeeded === qD && c.row(p, D).flags.pmPending, `${c.row(p, C).qtyNeeded} ${c.row(p, C).name} D ${c.row(p, D).qtyNeeded}`)
  await t.role('pm'); await t.press('7'); await approveD(); p = await t.proj()
  check('M1-3d Rev.c の承認で D の必要数、C は Rev.d の値のまま', c.row(p, D).qtyNeeded === qD + 1 && c.row(p, C).qtyNeeded === qC + 1 && c.row(p, C).name === 'NAME-C2', `${c.row(p, C).qtyNeeded} ${c.row(p, C).name} D ${c.row(p, D).qtyNeeded}`)
  exp[revC] = { C: [null, /まとめた/], D: [new RegExp(`必要数: ${qD} → ${qD + 1}`), /\d{4}-\d\d-\d\d/] }
  exp[revD] = { C: [new RegExp(`必要数: ${qC} → ${qC + 1}.*部品名: ${nC} → NAME-C2`), /\d{4}-\d\d-\d\d/] }
} else if (mode === 'dreject') {
  await approveD(); await t.role('pm'); await t.press('7')
  const dec = await t.decide(C, 'Shift+Y', '部品名は不可'); log('PM Shift+Y C →', dec.toast); p = await t.proj()
  const rC = c.row(p, C)
  log('after reject', c.subs(p), h.show(p, C), 'working', JSON.stringify(rC.working ?? null))
  check('M1-5 Rev.d の却下で C の公開値は元のまま、必要数（Rev.c からまとめた）と部品名の両方が作業中に戻る', rC.qtyNeeded === qC && rC.name === nC && rC.working?.qtyNeeded === qC + 1 && rC.working?.name === 'NAME-C2' && !rC.flags.pmPending, `qty=${rC.qtyNeeded} name=${rC.name} w=${JSON.stringify(rC.working)}`)
  await t.role('design'); await t.press('1'); log('C name back →', await t.setCellKey(C, 'name', nC)); log('publish Rev.e →', await t.publish('1'))
  p = await t.proj(); revE = p.submissions.at(-1).rev
  await t.role('pm'); await t.press('7'); await approveC(); p = await t.proj()
  check('M1-6 出し直した Rev.e の承認で C の必要数だけ公開値に', c.row(p, C).qtyNeeded === qC + 1 && c.row(p, C).name === nC, `${c.row(p, C).qtyNeeded} ${c.row(p, C).name}`)
  exp[revC] = { C: [null, /まとめた/], D: [new RegExp(`必要数: ${qD} → ${qD + 1}`), /\d{4}-\d\d-\d\d/] }
  exp[revD] = { C: [null, /却下/] }
  exp[revE] = { C: [new RegExp(`^必要数: ${qC} → ${qC + 1}$`), /\d{4}-\d\d-\d\d/] }
} else if (mode === 'crej') {
  const dec = await t.decide(D, 'Shift+Y', 'D の必要数は不可'); log('PM Shift+Y D →', dec.toast); p = await t.proj()
  log('after reject Rev.c', c.subs(p), h.show(p, C), 'C pa', JSON.stringify(c.row(p, C).pendingApproval), 'D working', JSON.stringify(c.row(p, D).working))
  check('M1-7 Rev.c の却下で D は作業中に戻り、まとめた C は Rev.d の承認待ちのまま（C の必要数の変更も残る）', c.row(p, D).working?.qtyNeeded === qD + 1 && c.row(p, D).qtyNeeded === qD && c.row(p, C).flags.pmPending && c.row(p, C).pendingRev === revD && c.row(p, C).pendingApproval?.qtyNeeded === qC + 1, `${h.show(p, C)} pa=${JSON.stringify(c.row(p, C).pendingApproval)} D w=${JSON.stringify(c.row(p, D).working)}`)
  await t.role('pm'); await t.press('7'); await approveC(); p = await t.proj()
  check('M1-8 Rev.d の承認で C の必要数・部品名が公開値に', c.row(p, C).qtyNeeded === qC + 1 && c.row(p, C).name === 'NAME-C2', `${c.row(p, C).qtyNeeded} ${c.row(p, C).name}`)
  exp[revC] = { C: [null, /まとめた/], D: [null, /却下/] }
  exp[revD] = { C: [new RegExp(`必要数: ${qC} → ${qC + 1}.*部品名: ${nC} → NAME-C2`), /\d{4}-\d\d-\d\d/] }
}
p = await t.proj()
check('M1-4 承認待ちのまま残る変更セットが無い（行が残っていない Rev は承認・却下・まとめた）', p.submissions.filter((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null).every((s) => !p.rows.some((r) => r.pendingRev === s.rev)), c.subs(p))
log('final', c.subs(p))
for (const role of ['design', 'purchasing', 'pm']) {
  const rows = { C: await c.chg(role, C), D: [] }; rows.D = await c.chg(role, D)
  log(role, '変更点 C', JSON.stringify(rows.C)); log(role, '変更点 D', JSON.stringify(rows.D))
  const bad = []
  for (const [rev, m] of Object.entries(exp)) for (const [k, [dre, are]] of Object.entries(m)) {
    const r = rows[k].find((x) => String(x[0]) === String(rev))
    if (role === 'purchasing' && p.submissions.find((s) => String(s.rev) === String(rev))?.changeSet?.rejected) { if (r) bad.push(`${k} Rev.${rev} 購買に却下の Rev が出る ${JSON.stringify(r)}`); continue }
    if (!r) { bad.push(`${k} Rev.${rev} なし`); continue }
    if (dre && !dre.test(r[2])) bad.push(`${k} Rev.${rev} 内容 ${r[2]}`)
    if (are && !are.test(r[3])) bad.push(`${k} Rev.${rev} 承認 ${r[3]}`)
  }
  check(`M1-X-${role} 変更点：まとめた Rev は「まとめた」、承認した Rev の内容は実際に公開値で変わった値（決まった Rev と比べる）`, !bad.length, bad.join(' | '))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
