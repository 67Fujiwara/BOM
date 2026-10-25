// n10: 辞退・全社辞退の行（見積済になる前／採用後）と、ほかの商社への依頼
//   mode=declall : 見積済（未選定）の行で S1〜S3 が全社辞退 → 状態・ボール・a の断り・購買の 9/4・Ctrl+. の候補 → S4 を相見積先に足して依頼・回答 → 見積済 → 採用
//   mode=declsel : 選定済の行で採用商社が辞退に変わる → 採用が外れる／正式依頼中なら取下げ → 次の商社を選び直す
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'declall'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
let p = await t.proj()
if (mode === 'declsel') { log('bulk →', await t.bulk()); p = await t.proj() }
const cand = mode === 'declall'
  ? p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積' && !r.adoptedSupplierId && !r.flags.contested && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays !== -1).length === 3)
  : p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
log('cands', cand.length)
const X = cand[0].id; log('X', h.show(p, X))
const in4 = async (role) => { await t.role(role); await t.press('4'); return (await t.viewRows()).includes(X) }
const in9 = async () => { await t.role('purchasing'); await t.press('9'); return (await t.viewRows()).includes(X) }
if (mode === 'declall') {
  await t.role('purchasing'); await t.press('6')
  for (const sid of ['S1', 'S2', 'S3']) log('decline', sid, '→', (await h.decline(X, sid)).slice(0, 100))
  p = await t.proj(); const r = p.rows.find((x) => x.id === X); log('after all declined', h.show(p, X), 'ball', await h.ballOf(X))
  check('N10-1 全社辞退で見積済のまま（選べる見積なし）にならない（見積中に戻る）', r.status === 'quoting' || r.status === 'submitted', h.show(p, X))
  check('N10-2 購買の 9 に出る', await in9(), '')
  log('purch 4 has X', await in4('purchasing'), '| design 4 has X', await in4('design'))
  await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(120); const aMsg = await t.toast(); log('design a →', aMsg)
  check('N10-3 設計の a は全社辞退と断る（採用しない）', !(await t.proj()).rows.find((x) => x.id === X).adoptedSupplierId, aMsg)
  await t.role('purchasing'); await t.press('9'); await t.goto(X); await t.press('Home'); await page.keyboard.press('Control+.'); await page.waitForTimeout(150); const pn = await t.panel(); log('Ctrl+. options', JSON.stringify(pn?.options?.map((o) => o.slice(0, 60))))
  check('N10-4 Ctrl+. に「ほかの商社に依頼する」「設計に代替を相談する」が出る', (pn?.options ?? []).some((o) => /ほかの商社/.test(o)) && (pn?.options ?? []).some((o) => /代替/.test(o)), JSON.stringify(pn?.options?.map((o) => o.slice(0, 40))))
  await page.keyboard.press('Escape'); await page.waitForTimeout(60); if (await t.panel()) await page.keyboard.press('Escape')
  // S4 を相見積先に足す
  await t.role('purchasing'); log('add S4 →', await h.setting('supplierIds', 'S1,S2,S3,S4', 'S4 を追加'))
  p = await t.proj(); log('supplierIds', JSON.stringify(p.supplierIds))
  const rq = await h.requestTo('S4'); log('request S4 →', rq.msg.slice(0, 160), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
  check('N10-5 S4 への依頼書に X が入る（辞退した商社には出さない）', rq.f.length === 1 && rq.f[0].ids.includes(X), JSON.stringify(rq.f))
  await t.press('6'); log('S4 price', await h.q(X, 'S4', 900, 12)); p = await t.proj(); log('X', h.show(p, X))
  check('N10-6 S4 が回答すると見積済になる（辞退 3 社は回答済として数える）', p.rows.find((x) => x.id === X).status === 'quoted', h.show(p, X))
  await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(150); p = await t.proj(); log('design a →', await t.toast(), h.show(p, X))
  check('N10-7 a で S4 を採用', p.rows.find((x) => x.id === X).adoptedSupplierId === 'S4', h.show(p, X))
  // 採用後に S4 が辞退
  await t.role('purchasing'); await t.press('6'); log('S4 declines →', (await h.decline(X, 'S4')).slice(0, 100)); p = await t.proj(); log('X after adopted supplier declined', h.show(p, X), 'ball', await h.ballOf(X))
  const r2 = p.rows.find((x) => x.id === X)
  check('N10-8 採用先が辞退したら採用が外れ、見積中に戻る', !r2.adoptedSupplierId && ['quoting', 'submitted'].includes(r2.status), h.show(p, X))
} else {
  await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj()
  const f = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)[0]; const Y = f.id; const sid = f.adoptedSupplierId
  log('Y', h.show(p, Y)); await t.press('6'); log('adopted', sid, 'declines →', (await h.decline(Y, sid)).slice(0, 100)); p = await t.proj(); log('Y after', h.show(p, Y), 'ball', await h.ballOf(Y))
  const r = p.rows.find((x) => x.id === Y)
  check('N10-1 正式依頼中の採用先が辞退したら採用が外れる（辞退した商社への取下げ連絡は要らないので記録は任意）', !r.adoptedSupplierId, h.show(p, Y))
  log('INFO formalWithdrawn =', r.flags.formalWithdrawn ?? '(なし)')
  check('N10-2 状態は見積済（ほかの商社の見積あり）で、選定者のボール', r.status === 'quoted' && (await h.ballOf(Y)) !== 'purchasing', h.show(p, Y) + ' ball=' + await h.ballOf(Y))
  await t.role('design'); await t.press('1'); await t.goto(Y); await t.press('Home'); await t.press('a'); await page.waitForTimeout(150); p = await t.proj(); log('design a →', await t.toast(), h.show(p, Y))
  check('N10-3 設計が a で別の商社を選び直せる（辞退した商社は選ばない）', p.rows.find((x) => x.id === Y).adoptedSupplierId && p.rows.find((x) => x.id === Y).adoptedSupplierId !== sid, h.show(p, Y))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
