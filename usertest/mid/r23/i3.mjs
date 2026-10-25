// i3: 支給品・社内在庫への切り替え（M14-01 の修正）と、その行を相見積に戻す流れ
//   Z: 選定済 → 支給品 → 相見積、Y: 正式見積済 → 社内在庫 → 相見積
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const sel = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Z = sel[3].id
const money0 = await t.money(); const hdr0 = (await t.header()).slice(0, 200)
await t.press('1'); await t.showCol('procurement', 'designated')
log('Z → 支給品', await t.setCellKey(Z, 'procurement', '支給品')); log('publish →', await t.publish('1'))
p = await t.proj(); log('Z after 支給品', h.show(p, Z), '|', await h.status(Z), 'ball', await h.ballOf(Z))
log('money', money0, '→', await t.money())
await t.role('purchasing'); const n0 = t.downloads.length; log('formal →', await t.requestFormal()); const f0 = await h.files(n0)
check('I3-1 支給品にした選定済の行は正式見積の依頼に入らない', !f0.some((f) => f.ids.includes(Z)), JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(Z)])))
p = await t.proj()
const Y = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.id !== Z && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
const adY = p.rows.find((r) => r.id === Y).adoptedSupplierId
{ const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === adY && !x.stale); await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await t.role('design'); await t.press('1'); log('Y → 社内在庫', await t.setCellKey(Y, 'procurement', '社内在庫')); log('publish →', await t.publish('1'))
p = await t.proj(); log('Y after 社内在庫', h.show(p, Y), 'withdrawn', p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? '-', '|', await h.status(Y))
await t.role('purchasing'); await t.press('3'); const oy = await t.order(Y); p = await t.proj(); log('order Y →', oy, p.rows.find((r) => r.id === Y).ordered)
check('I3-2 社内在庫にした正式見積済の行は発注できず、理由が「社内在庫」と分かる', !p.rows.find((r) => r.id === Y).ordered && /社内在庫|支給品|見積対象外|調達区分/.test(oy), oy)
// x で取下げを確認
await t.press('1'); await t.goto(Y); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80)
// 相見積に戻す（客先の支給が取りやめ・在庫が無かった）
await t.role('design'); await t.press('1')
log('Z → 相見積', await t.setCellKey(Z, 'procurement', '相見積')); log('Y → 相見積', await t.setCellKey(Y, 'procurement', '相見積'))
log('publish back →', await t.publish('1'))
p = await t.proj()
const st = {}
for (const id of [Z, Y]) { const r = p.rows.find((x) => x.id === id); st[id] = { status: r.status, adopt: r.adoptedSupplierId ?? null, ball: await h.ballOf(id), text: await h.status(id) }; log('back', h.show(p, id), '|', st[id].text, 'ball', st[id].ball) }
check('I3-3 支給品・社内在庫から相見積に戻した行は、見積があれば見積済（選定者のボール）・無ければ見積中に戻る（採用なしの「選定済」で止まらない）', [Z, Y].every((id) => ['quoted', 'quoting', 'submitted'].includes(st[id].status) || st[id].adopt), JSON.stringify(st))
await t.goto(Z); await t.press('a'); await page.waitForTimeout(80); const az = await t.toast(); p = await t.proj(); log('design a Z →', az, '|', h.show(p, Z))
check('I3-4 相見積に戻した行で a（推奨で採用）ができる', !!p.rows.find((r) => r.id === Z).adoptedSupplierId, az)
await t.role('purchasing'); const n1 = t.downloads.length; log('formal again →', await t.requestFormal()); const f1 = await h.files(n1)
log('formal again files', JSON.stringify(f1.map((f) => [f.sup, f.ids])))
p = await t.proj(); log('Z after formal', h.show(p, Z), '|', await h.status(Z)); log('Y after formal', h.show(p, Y), '|', await h.status(Y))
check('I3-5 相見積に戻して採用した行は正式見積の依頼に入る', f1.some((f) => f.ids.includes(Z)), JSON.stringify(f1.map((f) => [f.sup, f.ids])))
log('header', (await t.header()).slice(0, 200)); log('money', await t.money())
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i3')
summary(); await t.close()
