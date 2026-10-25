// q1: 概算の取り直し（再見積要の行に概算を依頼）で、採用と一緒に 納期NG・対策区分・特急分納の追加費用・委譲・再交渉・差分超過・PM の承認待ち・PM の依頼 が全て外れるか（M22-03 の直しの確認。状態ごと・PM の決定が途中の状態ごと）
//   usage: node q1.mjs <mode> [approval=0|1]
//   mode: ng | ng-e | ng-p | ng-d | ng-fail | formal | formal-ng | diff | diff-g | diff-q | diff-d | ltb | exc | early | early-ok | ordered | quoted-ltb
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck } from './plib.mjs'
import { inv } from './nlib.mjs'
const mode = process.argv[2] ?? 'ng'; const APPR = process.argv[3] === '1'
const tag = 'Q1-' + mode + (APPR ? 'a' : '')
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design')
if (APPR) { await t.publish('1'); await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制')); await t.role('design') }
await t.press('2'); if (mode !== 'exc' && mode !== 'ltb' && mode !== 'quoted-ltb' && !mode.startsWith('early')) log('bulk →', (await t.bulk()).slice(0, 60))
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.kind, i.status, i.by.role]))
let p = await t.proj(); let X = null
const pickNG = (extra = () => true) => p.rows.find((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.pmPending && extra(r))
async function pmDecide(id, key, text = '', extra) { await t.role('pm'); await t.press('7'); const r = await t.decide(id, key, text, extra); return r.toast }
async function diffRow() { // 正式見積を依頼し、単価を大きく変えた回答で差分超過にする
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-60)); p = await t.proj()
  const r = p.rows.find((x) => x.status === 'formalRequested' && !x.flags.leadNG && !x.flags.contested && x.procurement === '相見積' && p.quotes.some((q) => q.rowId === x.id && q.supplierId === x.adoptedSupplierId && !q.stale && q.unitPrice))
  const q = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(r.id, 'q.formalPrice@A', String(Math.round(q.unitPrice * 1.5) + 20000)); await t.press('Escape'); await t.press('Escape'); return r.id }
if (mode.startsWith('ng') || mode === 'formal-ng') {
  await t.setTime('2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300); await t.role('pm'); await t.press('7'); p = await t.proj()
  const r = pickNG(); if (!r) { check(tag + '-0 前提', false, 'no leadNG'); summary(); await t.close(); process.exit(0) }
  X = r.id; log('X', h.show(p, X).slice(0, 200))
  if (mode === 'ng-e') log('PM e →', await pmDecide(X, 'e', '特急で', { 上限金額: '30000' }))
  if (mode === 'ng-p') log('PM p →', await pmDecide(X, 'p', '購買で再選定'))
  if (mode === 'ng-d') log('PM d →', await pmDecide(X, 'd', '代替を'))
  if (mode === 'ng-fail') { log('PM d →', await pmDecide(X, 'd', '代替を')); await t.role('design'); await t.press('1'); await t.goto(X); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); const pn = await t.panel(); if (pn?.options?.some((o) => o.startsWith('7'))) { await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } await t.press('Escape'); await t.press('Escape') }
  if (mode === 'formal-ng') { await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-50)) }
} else if (mode.startsWith('diff')) {
  X = await diffRow(); p = await t.proj(); log('X diff', h.show(p, X).slice(0, 220), 'case', await h.caseOf(X))
  if (mode === 'diff-g') log('PM g →', await pmDecide(X, 'g', '再交渉'))
  if (mode === 'diff-q') log('PM q →', await pmDecide(X, 'q', '数量見直し'))
  if (mode === 'diff-d') log('PM d →', await pmDecide(X, 'd', '代替を'))
} else if (mode === 'formal') {
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-60)); p = await t.proj(); X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested)?.id
} else if (mode === 'ordered') {
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-60)); p = await t.proj()
  const r = p.rows.find((x) => x.status === 'formalRequested' && x.procurement === '相見積' && !x.flags.contested && p.quotes.some((q) => q.rowId === x.id && q.supplierId === x.adoptedSupplierId && !q.stale && q.unitPrice)); X = r.id
  const q = p.quotes.find((q) => q.rowId === X && q.supplierId === r.adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(X, 'q.formalLeadDays@A', '5'); await t.press('Escape'); log('order →', await t.order(X))
} else if (mode === 'ltb' || mode === 'quoted-ltb') {
  // 見積済で採用なしの行に購買が先行発注を申請（ltbPending）
  p = await t.proj(); const r = p.rows.find((x) => x.status === 'quoted' && !x.adoptedSupplierId && x.procurement === '相見積'); X = r?.id
  if (X) { await t.role('purchasing'); await t.press('5'); await t.goto(X); await t.cmd('先行発注を申請'); await page.waitForTimeout(100); const pn = await t.panel(); log('ltb panel', JSON.stringify(pn)?.slice(0, 150)); if (pn?.kind === 'prompt') { await t.promptFill('長納期'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150) } }
} else if (mode === 'exc') {
  // 例外選定（3 位）で PM 承認待ち（見積済のまま採用あり）
  await t.role('design'); await t.press('1')
  for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021', 'R022', 'R023', 'R024', 'R025']) { const r0 = await t.row(id); if (r0?.status !== 'quoted' && r0?.status !== 'selected') continue; if (r0.adoptedSupplierId) continue; await h.adoptPick(id, 3, '6', '評価用'); if ((await t.row(id)).flags.pmPending) { X = id; break } }
} else if (mode === 'early' || mode === 'early-ok') {
  const A = await h.addRow('R080', '先行採用リレーA', 'G2R-1 DC24', 'オムロン', '相見積'); X = A; log('publish →', await t.publish('1'))
  await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件')); log('request all →', (await h.requestTo(null)).msg.slice(0, 60))
  await t.press('6'); await h.q(A, 'S1', 1200, 5); await h.q(A, 'S2', 1300, 6); await t.press('Escape')
  await t.role('design'); await t.press('1'); log('early →', (await h.adoptPick(A, 1, '1', '急ぎ')).toast.slice(0, 60))
  if (mode === 'early-ok') log('PM y →', await (async () => { await t.role('pm'); return (await t.yes(A, '先行で')).toast })())
}
if (!X) { check(tag + '-0 前提：対象の行が作れた', false, 'none'); summary(); await t.close(); process.exit(0) }
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); const pre = h.show(p, X).slice(0, 260)
log('X before', pre, 'ball', await h.ballOf(X), 'case', await h.caseOf(X), 'iss', iss(p, X), 'extra', r0.extraCost, 'orderQty', r0.orderQty)
// 設計が必要数を大きく変えて公開（再見積要）
await t.role('design'); await t.press('1'); log('qty →', (await t.setCellKey(X, 'qtyNeeded', String(r0.qtyNeeded * 3 + 5))).slice(0, 40)); log('publish →', (await t.publish('1')).slice(-50))
if (APPR) { await t.role('pm'); await t.press('7'); const ids = await t.viewRows(); if (ids.includes(X)) { const y = await t.yes(X, '承認'); log('PM approve cs →', y.toast.slice(0, 60)) } }
p = await t.proj(); let dec0 = p.decisions.filter((d) => d.rowId === X).length; const r1 = p.rows.find((r) => r.id === X); log('X after publish', h.show(p, X).slice(0, 260), 'requote', r1.flags.requote)
await t.role('purchasing'); const rq = await h.requestTo(null); log('rough →', rq.msg.slice(0, 90), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
p = await t.proj(); let r2 = p.rows.find((r) => r.id === X); let f = r2.flags
if (r2.adoptedSupplierId && r2.flags.pmPending && r2.flags.requote && mode !== 'ordered') {
  // PM の決定が途中の行は概算の依頼から外れる（§: PM 承認待ちは自動除外）。PM が決めたあとの取り直しで外れるか
  const cs = await h.caseOf(X); log('in-flight PM case', cs, '→ PM decides, then purchasing re-requests')
  await t.role('pm'); await t.press('7')
  if (cs === '先行採用') {
    const y = await t.yes(X, '承認'); const msg = y.after?.error ?? y.toast; log('PM y (先行採用 on 再見積要) →', String(msg).slice(0, 120))
    const purchCan = rq.f.some((f) => f.ids.includes(X))
    check(tag + '-A PM が y を断られる（再見積要）のに、購買は取り直せない（概算の依頼から PM 承認待ちの行が外れる）→ 案内「見積を取り直してから判断」が実行できない', !(/取り直して/.test(String(msg)) && !purchCan), `msg=${String(msg).slice(0, 80)} purchCan=${purchCan}`)
    for (let i = 0; i < 3; i++) if (await t.panel()) await page.keyboard.press('Escape')
  }
  const dr = cs === '対策不成立' || cs === '先行採用' ? await t.decide(X, 'Shift+Y', cs === '先行採用' ? '却下' : '受入') : await t.yes(X, '承認'); log('PM →', dr.toast.slice(0, 80), JSON.stringify(dr.prompt)?.slice(0, 300), JSON.stringify(dr.after)?.slice(0, 300))
  p = await t.proj(); log('X after PM', h.show(p, X).slice(0, 240)); dec0 = p.decisions.filter((d) => d.rowId === X).length
  await t.role('purchasing'); const rq2 = await h.requestTo(null); log('rough#2 →', rq2.msg.slice(0, 90), JSON.stringify(rq2.f.map((f) => [f.sup, f.ids.includes(X)])))
  p = await t.proj(); r2 = p.rows.find((r) => r.id === X); f = r2.flags; log('X after rough#2', h.show(p, X).slice(0, 300), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
}
log('X after rough', h.show(p, X).slice(0, 300), 'ball', await h.ballOf(X), 'case', await h.caseOf(X), 'iss', iss(p, X), 'extra', r2.extraCost, r2.extraCostKind, 'orderQty', r2.orderQty)
if (mode === 'ordered') {
  check(tag + '-1 発注済の行は概算の取り直しで採用・発注を外さない（発注後変更依頼で扱う）', r2.status === 'ordered' && !!r2.adoptedSupplierId, h.show(p, X).slice(0, 200))
} else {
  const adoptGone = !r2.adoptedSupplierId
  check(tag + '-1 採用が外れている（概算を取り直す行は選び直し）', adoptGone, h.show(p, X).slice(0, 220))
  if (adoptGone) {
    check(tag + '-2 納期NG・対策区分・特急分納・委譲・再交渉・差分超過・再発行・拮抗の印が全て外れた', !f.leadNG && !f.countermeasure && !f.early && !f.delegated && !f.renegotiating && !f.formalDiff && !f.reissue && !f.contested, JSON.stringify(f))
    check(tag + '-3 追加費用（特急・分納）が外れた', r2.extraCost == null && !r2.extraCostKind, `${r2.extraCost} ${r2.extraCostKind}`)
    check(tag + '-4 PM の承認待ち（先行採用・例外選定・閾値超・先行発注判断・対策不成立・差分超過）が残らない', !(f.pmPending && f.pmReason !== '変更セット') && !f.ltbPending, JSON.stringify({ pm: f.pmPending, why: f.pmReason, ltb: f.ltbPending }))
    check(tag + '-5 PM の依頼（納期NG・コスト超過・数量見直し）の指摘が未対応のまま残らない', !p.issues.some((i) => i.rowId === X && i.by.role === 'pm' && ['納期NG', 'コスト超過', '数量見直し依頼'].includes(i.kind) && ['open', 'inProgress', 'answered'].includes(i.status)), iss(p, X))
    check(tag + '-6 PM の決定ケースが「なし」・ボールは購買（見積中）', (await h.caseOf(X)) === 'なし' && (await h.ballOf(X)) === 'purchasing' && r2.status === 'quoting', `${await h.caseOf(X)} ${await h.ballOf(X)} ${r2.status}`)
    await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); check(tag + '-7 PM の 7 に載らない', !in7, String(in7))
    check(tag + '-8 決定は増えていない（嘘の決定が記録されない）', p.decisions.filter((d) => d.rowId === X).length === dec0, `${dec0} → ${p.decisions.filter((d) => d.rowId === X).length}`)
    check(tag + '-9 正式回答・依頼Noが全て外れた', p.quotes.filter((q) => q.rowId === X).every((q) => q.formalPrice == null && !q.formalRequestNo))
    if (mode.startsWith('formal') || mode.startsWith('diff')) check(tag + '-10 正式依頼中だった行は取下げの案内が出る（購買の 9）', !!f.formalWithdrawn, String(f.formalWithdrawn))
    // 採用を選び直せる（見積が揃ったら見積済→ a で採用）
  }
}
if (mode === 'ltb' && r2.flags.ltbPending) {
  await t.role('pm'); await t.press('7'); await t.goto(X); await t.press('Enter'); await page.waitForTimeout(120); const pn = await t.panel(); log('PM panel on stale ltb row', JSON.stringify(pn)?.slice(0, 500))
  await t.press('Escape'); if (await t.panel()) await t.press('Escape')
  const y = await t.yes(X, '許可'); p = await t.proj(); log('PM y →', y.toast.slice(0, 100), JSON.stringify(y.after)?.slice(0, 200), '|', h.show(p, X).slice(0, 260), 'ball', await h.ballOf(X))
  check(tag + '-13 採用に使える見積が無い行の「先行発注判断」を PM が y で許可できてしまわない（許可すると採用なしの選定済／固まる）', !(p.rows.find((r) => r.id === X).status === 'selected' && !p.rows.find((r) => r.id === X).adoptedSupplierId), h.show(p, X).slice(0, 200))
  const sk2 = await stuck(t); log('stuck', JSON.stringify(sk2)); check(tag + '-14 固まる行がない（許可のあと）', sk2.length === 0, sk2.slice(0, 3))
}
const vio = inv(p); check(tag + '-11 不変条件', !vio.length, vio.join('|'))
const sk = await stuck(t); check(tag + '-12 固まる行がない', sk.length === 0, sk.slice(0, 4))
errs(t, tag + '-99'); summary(); await t.close()
