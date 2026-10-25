// g1: 正式依頼取下げ（M13-03 の修正）。正式依頼中 X・正式見積済 Y の調達区分を切り替える
//   mode=designated: 相見積 → 指定商社（別の商社）。取下げの印・ステータスバー・前の正式回答の消去・購買のビュー・次の正式依頼で外れるか
//   mode=supply    : 相見積 → 支給品 / 社内在庫。取下げ・採用の扱い、発注・正式依頼に残らないか（§3.4）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'designated'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
// 支給品にする選定済の行（正式依頼の前）
const sel = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending)
const Z = sel[5].id
if (mode === 'supply') {
  await t.press('1'); await t.showCol('procurement', 'designated')
  log('Z', Z, 'procurement →', await t.setCellKey(Z, 'procurement', '社内在庫'))
  log('publish Z →', await t.publish('1'))
  p = await t.proj(); log('Z after 社内在庫', h.show(p, Z), '|', await h.status(Z))
}
await t.role('purchasing'); const n0 = t.downloads.length; log('formal →', await t.requestFormal())
const f0 = await h.files(n0); log('formal files', JSON.stringify(f0.map((f) => [f.sup, f.ids.length])))
const zInFormal = f0.some((f) => f.ids.includes(Z))
p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.id !== Z && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const X = fr[0].id, Y = fr[1].id
const adX = fr[0].adoptedSupplierId, adY = fr[1].adoptedSupplierId
const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === adY && !q.stale)
await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); for (const id of [X, Y]) log('before', h.show(p, id), '|', await h.status(id), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null])))
const other = (sid) => (sid === 'S2' ? 'S1' : 'S2')
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
if (mode === 'designated') {
  for (const [id, ad] of [[X, adX], [Y, adY]]) { await t.setCellKey(id, 'procurement', '指定商社'); await t.setCellKey(id, 'designated', NAMES[other(ad)]) }
} else {
  await t.setCellKey(X, 'procurement', '支給品'); await t.setCellKey(Y, 'procurement', '社内在庫')
}
log('publish switch →', await t.publish('1'))
p = await t.proj()
const after = {}
for (const id of [X, Y]) { after[id] = p.rows.find((r) => r.id === id); log('after switch', h.show(p, id), 'withdrawn=', after[id].flags.formalWithdrawn ?? '-', '|', await h.status(id), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null, q.formalPrice ?? null]))) }
await t.role('purchasing'); await t.press('1')
const stX = await t.cellText(X, 'status'), stY = await t.cellText(Y, 'status')
await t.goto(X); await t.press('Home'); const sbX = (await t.status()).slice(0, 200)
log('purch status X', stX, '| Y', stY); log('purch statusbar X', sbX)
const views = {}
for (const v of [4, 8, 9]) { await t.press(String(v)); const rs = await t.viewRows(); views[v] = [rs.includes(X), rs.includes(Y)] }
log('purch views has X/Y', JSON.stringify(views))
const inbox = await page.evaluate(async () => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return d.ballCounts(s.project()) })
log('ball counts', JSON.stringify(inbox), 'ball X', await h.ballOf(X), 'Y', await h.ballOf(Y))
if (mode === 'designated') {
  const wX = after[X].flags.formalWithdrawn ?? '', wY = after[Y].flags.formalWithdrawn ?? ''
  check('G1-1 正式依頼中・正式見積済の行を別の商社の指定商社にすると「正式依頼取下げ」（元の商社名と依頼No）が付く', wX.includes(NAMES[adX]) && /F\d/.test(wX) && wY.includes(NAMES[adY]), `X=${wX} Y=${wY}`)
  check('G1-2 購買の状態の列・ステータスバーに取下げが出る', /正式依頼取下げ/.test(stX) && /正式依頼取下げ/.test(stY) && /取り下げ/.test(sbX), `${stX} / ${stY} / ${sbX}`)
  const oldQ = p.quotes.filter((q) => [X, Y].includes(q.rowId) && !q.stale && ((q.rowId === X && q.supplierId === adX) || (q.rowId === Y && q.supplierId === adY)))
  check('G1-3 前の採用商社の正式回答・正式依頼番号が消える', oldQ.every((q) => q.formalPrice == null && !q.formalRequestNo), JSON.stringify(oldQ.map((q) => [q.rowId, q.supplierId, q.formalPrice, q.formalRequestNo])))
  // 指定先に概算を頼んで回答 → 選定済 → 正式見積を依頼
  for (const [id, ad] of [[X, adX], [Y, adY]]) { const sid = other(ad); const r = await h.requestTo(sid); log('rough to', sid, '→', r.msg, JSON.stringify(r.f.map((f) => [f.sup, f.ids]))) }
  await t.press('6')
  for (const [id, ad] of [[X, adX], [Y, adY]]) { const sid = other(ad); log('quote', id, sid, await h.q(id, sid, 500, 5)) }
  p = await t.proj(); for (const id of [X, Y]) log('after designated quote', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
  const n1 = t.downloads.length; log('formal again →', await t.requestFormal())
  const f1 = await h.files(n1); log('formal again files', JSON.stringify(f1.map((f) => [f.sup, f.ids])))
  p = await t.proj(); for (const id of [X, Y]) log('after formal again', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
  const rx = p.rows.find((r) => r.id === X), ry = p.rows.find((r) => r.id === Y)
  check('G1-4 新しい指定先に正式見積を依頼したら取下げの印が外れ、正式依頼中（新しい商社）', rx.status === 'formalRequested' && rx.adoptedSupplierId === other(adX) && !rx.flags.formalWithdrawn && ry.status === 'formalRequested' && !ry.flags.formalWithdrawn, `${h.show(p, X)} / ${h.show(p, Y)}`)
  log('INFO 元の商社宛の取下げの書類', f1.some((f) => f.sup === NAMES[adX] || f.sup === NAMES[adY]) ? 'あり' : 'なし（依頼書は新しい指定先だけ）')
} else {
  const rx = after[X], ry = after[Y]
  check('G1-5 正式依頼中の行を支給品・正式見積済の行を社内在庫にすると、採用商社への正式依頼は取り下げ（取下げの印、採用・正式回答を残さない）', !!rx.flags.formalWithdrawn && !!ry.flags.formalWithdrawn && !rx.adoptedSupplierId && !ry.adoptedSupplierId, `X: ${h.show(p, X)} w=${rx.flags.formalWithdrawn} | Y: ${h.show(p, Y)} w=${ry.flags.formalWithdrawn}`)
  // Y（社内在庫）を発注できるか
  await t.press('3'); const oy = await t.order(Y); p = await t.proj(); const ry2 = p.rows.find((r) => r.id === Y)
  log('order Y (社内在庫) →', oy, '| ordered', ry2.ordered, ry2.status)
  check('G1-6 社内在庫にした行は商社に発注できない', !ry2.ordered, `${oy} / ordered=${ry2.ordered}`)
  if (ry2.ordered) { await t.press('Control+z'); await page.waitForTimeout(100) }
  check('G1-7 社内在庫にした選定済の行は正式見積の依頼に入らない', !zInFormal, `Z=${Z} in formal=${zInFormal}`)
  log('money', await t.money())
}
await t.shot('g1-' + mode)
summary(); await t.close()
