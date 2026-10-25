// p2: 承認 ON。選定済／正式依頼中／発注済の行の調達区分を 支給品／社内在庫 に変えて公開 → PM の承認待ち → 承認／却下。ボール・3/8/9・購買待ち・総額・取下げ・入荷
//   usage: node p2.mjs selected|formal|ordered 支給品|社内在庫 approve|reject
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
import { errs, scanViews, stuck } from './plib.mjs'
const stage = process.argv[2] ?? 'selected'; const to = process.argv[3] ?? '支給品'; const dec = process.argv[4] ?? 'approve'; const tag = `P2-${stage}-${to}-${dec}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup(); let p = await t.proj()
let X = sel.find((r) => !r.needDateFixed && r.adoptedSupplierId === 'S1').id
if (stage !== 'selected') {
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-40)); p = await t.proj(); X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.adoptedSupplierId === 'S1').id
  if (stage === 'ordered') {
    const q = p.quotes.find((q) => q.rowId === X && q.supplierId === 'S1' && !q.stale); await t.press('8')
    await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(X, 'q.formalLeadDays@A', '10'); await t.press('Escape'); log('order →', await t.order(X))
  }
}
p = await t.proj(); log('X', X, h.show(p, X).slice(0, 180))
const snap = async (label) => {
  p = await t.proj(); const r = rowOf(p, X)
  const info = await page.evaluate(async (id) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); return { rough: d.totals(pp).rough, ball: d.ball(pp, pp.rows.find((x) => x.id === id)) } }, X)
  const v = {}; for (const role of ['purchasing', 'pm', 'design']) { await t.role(role); for (const n of [3, 7, 8, 9]) { await t.press(String(n)); v[`${role[0]}${n}`] = (await t.viewRows()).includes(X) } }
  const line = `${label}: proc=${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty ?? '-'} ball=${info.ball} total=${info.rough} pend=${JSON.stringify(r.pendingApproval ?? null)} wd=${r.flags.formalWithdrawn ?? '-'} views=${Object.entries(v).filter(([, b]) => b).map(([k]) => k).join(',')}`
  log(line); return { r, info, v, line }
}
const s0 = await snap('start')
await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated')
log('switch →', (await t.setCellKey(X, 'procurement', to)).slice(0, 80)); log('publish →', (await t.publish('1')).slice(-50))
const s1 = await snap('pending'); checkInv(`${tag}-0`, await t.proj())
if (stage === 'ordered') {
  check(`${tag}-1 発注済の行は調達区分を変えられない（設計の列がロック）`, s1.r.procurement === '相見積' && s1.r.status === 'ordered', s1.line)
} else {
  check(`${tag}-1 公開すると PM の承認待ち（変更セット）。公開値はまだ相見積で、採用も残る`, s1.r.flags.pmPending && s1.r.procurement === '相見積' && !!s1.r.adoptedSupplierId, s1.line)
  check(`${tag}-2 承認待ちのあいだ PM の 7 に載り、ボールは PM`, s1.v.p7 && s1.info.ball === 'pm', s1.line)
  await t.role('pm'); await t.press('7'); const r = dec === 'approve' ? await t.yes(X, '調達区分を変える') : await t.decide(X, 'Shift+Y', '変えない'); log('PM', dec, '→', r.toast.slice(0, 80))
  const s2 = await snap('after ' + dec); checkInv(`${tag}-3`, await t.proj())
  if (dec === 'approve') {
    check(`${tag}-4 承認で ${to} になる（採用・発注数・正式依頼の印を持たない）`, s2.r.procurement === to && !s2.r.adoptedSupplierId && !s2.r.flags.pmPending && !s2.r.flags.leadNG && !s2.r.flags.formalDiff, s2.line)
    check(`${tag}-5 ${to} の行は購買の 3・8・9 と PM の 7 に出ない（取下げを伝える行の 9 は除く）`, !s2.v.p3 && !s2.v.p8 && !s2.v.m7 && !(s2.v.p9 && !s2.r.flags.formalWithdrawn), s2.line)
    check(`${tag}-6 ボールはどの役割にも無い（購買待ちに数えない）`, s2.info.ball == null || s2.info.ball === 'design', s2.line)
    check(`${tag}-7 総額（概算）から外れる`, s2.info.rough < s0.info.rough, `${s0.info.rough} → ${s2.info.rough}`)
    if (stage === 'formal') check(`${tag}-8 正式依頼中の行を ${to} にすると、元の商社への取下げが購買の 9 に出る（x で伝える）`, !!s2.r.flags.formalWithdrawn && s2.v.p9, s2.line)
  } else {
    check(`${tag}-4 却下で相見積のまま・採用も残る・承認待ちが外れる`, s2.r.procurement === '相見積' && !!s2.r.adoptedSupplierId && !s2.r.flags.pmPending, s2.line)
    check(`${tag}-5 却下したあと、${to} への変更は設計の作業中に戻る`, s2.r.working?.procurement === to || (s2.r.pendingApproval == null && s2.r.working?.procurement === to), JSON.stringify(s2.r.working ?? null))
    check(`${tag}-6 却下で総額が変わらない`, s2.info.rough === s0.info.rough, `${s0.info.rough} → ${s2.info.rough}`)
  }
  // 戻す（相見積）：公開 → 承認 → 見積の対象に戻る
  if (dec === 'approve') {
    await t.role('design'); await t.press('1'); log('back →', (await t.setCellKey(X, 'procurement', '相見積')).slice(0, 60)); log('publish →', (await t.publish('1')).slice(-40))
    await t.role('pm'); await t.press('7'); const b = await t.yes(X, '相見積に戻す'); log('PM back →', b.toast.slice(0, 70)); const s3 = await snap('back to 相見積'); checkInv(`${tag}-9`, await t.proj())
    check(`${tag}-10 相見積に戻した行は採用なしの選定済のまま残らない`, !(['selected', 'formalRequested', 'formalQuoted'].includes(s3.r.status) && !s3.r.adoptedSupplierId), s3.line)
    check(`${tag}-11 戻した行は誰かのボール（購買 9／設計の選定）に載る`, s3.info.ball != null, s3.line)
  }
}
const sk = await stuck(t); check(`${tag}-12 固まる行がない`, sk.length === 0, sk.slice(0, 4))
const bad = await scanViews(t, ['purchasing', 'pm', 'design'], [3, 7, 8, 9]); check(`${tag}-13 文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
errs(t, tag + '-14'); summary(); await t.close()
