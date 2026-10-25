// m6: 取引停止で採用を外した行のステータスバー（U18-03 の修正「だれが次に何をするか・取下げの依頼No も出す」）
//   mode=selector  : 選定者＝購買 にした案件で、ミスミ採用の相見積の行（選定済 S・正式依頼中 F）をミスミの取引停止（JSON）→ 購買「選び直してください」、設計「選定者が選び直します」、ボール・4、購買が a で選び直す
//   mode=designated: ミスミを指定先にした指定商社の行（正式依頼中 D）をミスミの取引停止 → 文・取下げの依頼No・ボール（設計）・設計の 4 → 設計が指定先を立花に → 購買が概算見積を依頼 → 立花で採用・正式依頼
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'selector'
const t = await launch(); const { page } = t; const h = helpers(t)
async function importTradable(sid, tradable) {
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable } : s))
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus()
  return t.toast()
}
async function sb(role, view, id) { await t.role(role); await t.press(String(view)); await t.goto(id); await t.press('Home'); return (await t.status()).slice(0, 360) }
await t.open('design')
let p
if (mode === 'selector') {
  await t.role('pm'); log('selector 購買 →', await h.setting('selector', '購買', '購買が選ぶ'))
  await t.role('purchasing'); log('bulk →', await t.bulk())
  p = await t.proj()
  const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length >= 2)
  const F = s3[0].id, S = s3[1].id
  log('F', h.show(p, F), 'S', h.show(p, S))
  await t.role('design'); await t.press('1'); log('S note →', await t.setCellKey(S, 'note', '作業中'))
  await t.role('purchasing'); log('formal F →', await t.requestFormal())
  await t.role('design'); await t.press('1'); await t.press('Control+z'); await page.waitForTimeout(150)
  await t.role('purchasing'); log('import stop S3 →', await importTradable('S3', false))
  p = await t.proj(); log('F after', h.show(p, F), 'wd', p.rows.find((r) => r.id === F).flags.formalWithdrawn ?? '-'); log('S after', h.show(p, S))
  const sbSp = await sb('purchasing', 1, S), sbSd = await sb('design', 1, S), sbFp = await sb('purchasing', 1, F)
  log('S purch sb', sbSp); log('S design sb', sbSd); log('F purch sb', sbFp)
  check('M6S-1 選定者＝購買：購買のステータスバーは「選び直してください」、設計は「選定者が選び直します」', /選び直してください/.test(sbSp) && /選定者が選び直します/.test(sbSd), [sbSp, sbSd])
  check('M6S-2 正式依頼中だった F の購買のステータスバーに取下げの依頼No（ミスミ P-2026-041-S3-F）', /P-2026-041-S3-F/.test(sbFp), sbFp)
  const ball = await h.ballOf(S); const p4 = await h.inView('purchasing', 4, S); const p9 = await h.inView('purchasing', 9, S); const d4 = await h.inView('design', 4, S)
  log('ball S', ball, 'purch 4', p4, 'purch 9', p9, 'design 4', d4)
  check('M6S-3 ボールは購買（選定者）で購買の 4 か 9 に出る、設計の 4 には出ない', ball === 'purchasing' && (p4 || p9) && !d4, { ball, p4, p9, d4 })
  await t.role('purchasing'); await t.press('1'); for (const id of [S, F]) { await t.goto(id); await t.press('Home'); await t.press('a'); await page.waitForTimeout(100); log('a', id, '→', await t.toast()) }
  p = await t.proj(); log('S re', h.show(p, S)); log('F re', h.show(p, F))
  check('M6S-4 購買（選定者）が a で選び直せる（ミスミ以外）', ['S', 'F'].every((k) => { const r = p.rows.find((x) => x.id === (k === 'S' ? S : F)); return r.adoptedSupplierId && r.adoptedSupplierId !== 'S3' }), `${h.show(p, S)} | ${h.show(p, F)}`)
  const sbF2 = await sb('purchasing', 1, F); log('F purch sb after', sbF2)
  check('M6S-5 選び直したあとも、ミスミへの取下げ（依頼No）は x まで出る', /P-2026-041-S3-F/.test(sbF2), sbF2)
} else {
  log('bulk →', await t.bulk()); p = await t.proj()
  const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
  const D = p.rows.find((r) => clean.includes(r.id) && r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積' && p.quotes.some((q) => q.rowId === r.id && q.supplierId === 'S2' && !q.stale && q.unitPrice != null && q.leadDays >= 0)).id
  log('D', h.show(p, D))
  await t.showCol('designated', 'procurement'); await t.press('1')
  log('proc →', await t.setCellKey(D, 'procurement', '指定商社')); log('designated →', await t.setCellKey(D, 'designated', 'ミスミ')); log('publish →', await t.publish('1'))
  p = await t.proj(); log('D after 指定', h.show(p, D))
  await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj(); log('D formal', h.show(p, D), p.rows.find((r) => r.id === D).status)
  log('import stop S3 →', await importTradable('S3', false))
  p = await t.proj(); const rD = p.rows.find((r) => r.id === D); log('D after stop', h.show(p, D), rD.status, 'wd', rD.flags.formalWithdrawn ?? '-')
  const sbDp = await sb('purchasing', 1, D), sbDd = await sb('design', 1, D)
  log('D purch sb', sbDp); log('D design sb', sbDd)
  check('M6D-1 指定商社の行：購買・設計のステータスバーに「設計が指定先を変えます」と取下げの依頼No（ミスミ P-2026-041-S3-F）', /指定先を変え/.test(sbDp) && /指定先を変え/.test(sbDd) && /P-2026-041-S3-F/.test(sbDp), [sbDp, sbDd])
  const ball = await h.ballOf(D); const d4 = await h.inView('design', 4, D); log('ball', ball, 'design 4', d4)
  check('M6D-2 ボールは設計（指定先を変える）で設計の 4 に出る', ball === 'design' && d4, { ball, d4 })
  await t.role('design'); await t.press('1'); await t.showCol('designated'); log('designated 立花 →', await t.setCellKey(D, 'designated', '立花エレテック')); log('publish →', await t.publish('1'))
  p = await t.proj(); log('D after 立花', h.show(p, D), p.rows.find((r) => r.id === D).status)
  await t.role('purchasing'); await t.press('9'); const rq = await h.requestTo(null); log('rough →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(D)])), JSON.stringify(rq.options))
  p = await t.proj(); log('D after rough', h.show(p, D), p.rows.find((r) => r.id === D).status)
  const s2q = p.quotes.find((q) => q.rowId === D && q.supplierId === 'S2' && !q.stale)
  if (!(s2q && s2q.unitPrice != null)) { await t.press('6'); log('S2 answer →', await h.q(D, 'S2', 1234, 7)) }
  p = await t.proj(); log('D after S2 answer', h.show(p, D), p.rows.find((r) => r.id === D).status)
  check('M6D-3 立花を指定先にすると立花の見積で立花を採用（選定済）', p.rows.find((r) => r.id === D).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === D).status === 'selected', h.show(p, D))
  const n0 = t.downloads.length; log('formal 2 →', await t.requestFormal()); const f2 = await h.files(n0); log('files', JSON.stringify(f2.map((f) => [f.sup, f.ids.includes(D)])))
  check('M6D-4 正式見積の依頼書は立花に D、ミスミには出ない', f2.some((f) => f.sup === '立花エレテック' && f.ids.includes(D)) && !f2.some((f) => f.sup === 'ミスミ'), JSON.stringify(f2.map((f) => [f.sup, f.ids.length])))
  const sbD3 = await sb('purchasing', 1, D); log('D purch sb after', sbD3)
  check('M6D-5 ミスミへの取下げ（依頼No）は x まで残る', /P-2026-041-S3-F/.test(sbD3), sbD3)
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
