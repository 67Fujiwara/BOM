// p11: 納期NG が付いた選定済の行の必要数を大きく変えて（再見積要）、概算見積を取り直す（f2-9・f2-25 の乱数列から）。納期NG の印だけ残って採用が無い行にならないか
//   usage: node p11.mjs [approval=0|1]
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck } from './plib.mjs'
const tag = 'P11'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.bulk()
await t.setTime('2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300); await t.role('pm'); await t.press('7')
let p = await t.proj(); const lng = p.rows.filter((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.needDateFixed)
log('leadNG rows', lng.length, lng.slice(0, 5).map((r) => r.id).join(','))
if (!lng.length) { check(`${tag}-0 前提：納期NG の選定済の行が作れた`, false, 'none'); summary(); await t.close(); process.exit(0) }
const X = lng[0].id; log('X', h.show(p, X).slice(0, 220), 'ball', await h.ballOf(X))
await t.role('design'); await t.press('1'); log('qty x3 →', (await t.setCellKey(X, 'qtyNeeded', String(lng[0].qtyNeeded * 3 + 5))).slice(0, 40)); log('publish →', (await t.publish('1')).slice(-40))
p = await t.proj(); log('X after publish', h.show(p, X).slice(0, 240))
await t.role('purchasing'); const r = await h.requestTo(null); log('rough →', r.msg.slice(0, 80), JSON.stringify(r.f.map((f) => [f.sup, f.ids.includes(X)])))
p = await t.proj(); const rX = p.rows.find((x) => x.id === X); log('X after rough', h.show(p, X).slice(0, 260), 'ball', await h.ballOf(X))
check(`${tag}-1 概算を取り直したあと、採用が外れた行に納期NG の印が残らない（採用なしの納期NG にならない）`, !(rX.flags.leadNG && !rX.adoptedSupplierId), h.show(p, X).slice(0, 220))
await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('in PM 7', in7)
if (in7) { await t.goto(X); await t.press('Enter'); await page.waitForTimeout(150); const pn = await t.panel(); log('PM panel', JSON.stringify(pn)?.slice(0, 400)); check(`${tag}-2 PM の 7 に載る行は決定パネルに選べる選択肢がある`, !!pn && (pn.options?.length ?? 0) > 0 || !!pn?.lines, JSON.stringify(pn)?.slice(0, 200)); await t.press('Escape'); if (await t.panel()) await t.press('Escape') }
const sk = await stuck(t); check(`${tag}-3 固まる行がない`, sk.length === 0, sk.slice(0, 4))
errs(t, tag + '-9'); summary(); await t.close()
