// q3: 承認 OFF。選定済／正式依頼中／正式見積済の行の調達区分を 支給品／社内在庫 → 相見積 → 支給品 と切り替える（公開だけで即時）。
//   ボール・ビュー 3/7/8/9（3 役割）・状態・総額・取下げ・「見積済 n/80」の分母・戻したあとの再依頼・発注の Excel／選定記録の Excel に出ないこと
//   usage: node q3.mjs selected|formal|formalq|fixed  支給品|社内在庫
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
import { errs, scanViews, stuck } from './plib.mjs'
const stage = process.argv[2] ?? 'selected'; const to = process.argv[3] ?? '支給品'; const tag = `Q3-${stage}-${to}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
await t.open('design'); await t.publish('1'); await t.press('2'); log('bulk →', (await t.bulk()).slice(0, 50))
let p = await t.proj()
const okRow = (r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && !r.working && !r.needDateFixed
let X = p.rows.find(okRow)?.id
if (stage === 'formal' || stage === 'formalq') {
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-40)); p = await t.proj(); X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed)?.id
  if (stage === 'formalq') { const q = p.quotes.find((q) => q.rowId === X && q.supplierId === 'S1' && !q.stale); await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(X, 'q.formalLeadDays@A', '10'); await t.press('Escape'); p = await t.proj() }
}
if (stage === 'fixed') { // 指定商社の行（固定採用）を支給品へ
  await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated'); X = p.rows.find((r) => r.procurement === '相見積' && r.status === 'selected' && !r.flags.contested && !r.working).id
  await t.setCellKey(X, 'designated', 'S2'); await t.setCellKey(X, 'procurement', '指定商社'); log('→指定商社', (await t.publish('1')).slice(-40)); p = await t.proj() }
log('X', X, h.show(p, X).slice(0, 200))
const snap = async (label) => {
  p = await t.proj(); const r = rowOf(p, X)
  const info = await page.evaluate(async (id) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); return { rough: d.totals(pp).rough, ball: d.ball(pp, pp.rows.find((x) => x.id === id)) } }, X)
  const v = {}; for (const role of ['purchasing', 'pm', 'design']) { await t.role(role); for (const n of [3, 4, 5, 7, 8, 9]) { await t.press(String(n)); v[`${role[0]}${n}`] = (await t.viewRows()).includes(X) } }
  const line = `${label}: proc=${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty ?? '-'} ball=${info.ball} total=${info.rough} wd=${r.flags.formalWithdrawn ?? '-'} views=${Object.entries(v).filter(([, b]) => b).map(([k]) => k).join(',')}`
  log(line); return { r, info, v, line }
}
const s0 = await snap('start')
await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated')
log('switch →', (await t.setCellKey(X, 'procurement', to)).slice(0, 80)); log('publish →', (await t.publish('1')).slice(-50))
const s1 = await snap('after ' + to); checkInv(`${tag}-0`, await t.proj())
check(`${tag}-1 ${to} になる。採用・発注数・正式依頼の印・納期NG を持たない`, s1.r.procurement === to && !s1.r.adoptedSupplierId && !s1.r.flags.pmPending && !s1.r.flags.leadNG && !s1.r.flags.formalDiff && !s1.r.flags.reissue, s1.line)
check(`${tag}-2 ${to} の行は購買の 3・8・9 と PM の 7 に出ない（取下げの案内の 9 は除く）`, !s1.v.p3 && !s1.v.p8 && !s1.v.m7 && !(s1.v.p9 && !s1.r.flags.formalWithdrawn), s1.line)
check(`${tag}-3 ボールはどの役割にも無い（購買待ちに数えない）`, s1.info.ball == null, s1.line)
check(`${tag}-4 総額（概算）から外れる`, s1.info.rough < s0.info.rough, `${s0.info.rough} → ${s1.info.rough}`)
check(`${tag}-5 状態は選定済のまま（見積もの・発注の対象外）`, s1.r.status === 'selected', s1.line)
if (stage.startsWith('formal')) check(`${tag}-6 正式依頼中だった行は、元の商社への取下げが購買の 9 に出る`, !!s1.r.flags.formalWithdrawn && s1.v.p9, s1.line)
if (stage.startsWith('formal')) { // 取下げを x で伝える
  await t.role('purchasing'); await t.press('9'); await t.goto(X); await page.keyboard.press('x'); await page.waitForTimeout(100); log('x →', (await t.toast()).slice(0, 100)); const s1b = await snap('after x'); check(`${tag}-7 x で取下げが消え、9 から外れる`, !s1b.r.flags.formalWithdrawn && !s1b.v.p9, s1b.line) }
// 購買の「正式見積を依頼」が ${to} の行に依頼書を出さない／発注（o）が断られる
await t.role('purchasing'); await t.press('3'); const orderMsg = await t.order(X); log('order →', orderMsg.slice(0, 100)); p = await t.proj(); check(`${tag}-8 購買が ${to} の行を発注できない`, rowOf(p, X).status === 'selected' && !rowOf(p, X).ordered, orderMsg.slice(0, 80))
const n0 = t.downloads.length; log('formal again →', (await t.requestFormal()).slice(-60)); const fl = await h.files(n0); check(`${tag}-9 正式見積の依頼書に ${to} の行が入らない`, !fl.some((f) => f.ids.includes(X)), JSON.stringify(fl))
// 選定記録・Excel
await t.role('purchasing'); const ex = await c.excel(0); const bomHas = ex.some((s) => s.sh !== '変更点' && s.sh !== 'チェック結果' && s.rows.some((r) => r[0] === X)); log('purchasing Excel BOM has X', bomHas)
// 社内に戻す（相見積）
await t.role('design'); await t.press('1'); log('back →', (await t.setCellKey(X, 'procurement', '相見積')).slice(0, 60)); log('publish →', (await t.publish('1')).slice(-40))
const s2 = await snap('back to 相見積'); checkInv(`${tag}-10`, await t.proj())
check(`${tag}-11 相見積に戻した行は採用なしの選定済のまま残らない`, !(['selected', 'formalRequested', 'formalQuoted'].includes(s2.r.status) && !s2.r.adoptedSupplierId), s2.line)
check(`${tag}-12 戻した行は誰かのボールに載り、購買の 9／設計の 4/5 のどこかに出る`, s2.info.ball != null && (s2.v.p9 || s2.v.p5 || s2.v.d4 || s2.v.d5 || s2.v.p4), s2.line)
// もう一度 支給品 → 社内在庫（A→B 直接）
const other = to === '支給品' ? '社内在庫' : '支給品'
await t.role('design'); await t.press('1'); await t.setCellKey(X, 'procurement', to); await t.publish('1'); await t.setCellKey(X, 'procurement', other); log('A→B publish →', (await t.publish('1')).slice(-40))
const s3 = await snap('A→B'); check(`${tag}-13 ${to} → ${other} へ直接切り替えても採用を持たず、どのビューにも出ない`, s3.r.procurement === other && !s3.r.adoptedSupplierId && !s3.v.p3 && !s3.v.p8 && s3.info.ball == null, s3.line)
const sk = await stuck(t); check(`${tag}-14 固まる行がない`, sk.length === 0, sk.slice(0, 4))
const bad = await scanViews(t, ['purchasing', 'pm', 'design'], [3, 7, 8, 9]); check(`${tag}-15 文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
errs(t, tag + '-99'); summary(); await t.close()
