// l5: 客先指定品（R034 オムロン、依頼先 因幡）の依頼先の取引停止（M17-01 の修正）の先
//   mode=formal  : 因幡に正式依頼中に取引停止（JSON の読み込み）→ 取下げ・理由・次の商社（立花）に概算 → 回答 → 正式依頼は立花 → 因幡を取引可に戻す（JSON）→ 依頼先・採用が立花のまま
//   mode=pending : 取引停止 → 立花に概算見積を依頼（回答待ち）→ 因幡を取引可に戻す → 依頼先はどちらか・立花の回答はどう扱われるか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'formal'
const t = await launch(); const { page } = t; const h = helpers(t)
const X = 'R034'
const fixedOf = () => page.evaluate(async (X) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return d.fixedSupplierId(p, p.rows.find((r) => r.id === X), s.ws.suppliers) }, X)
async function importTradable(sid, tradable) {
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable } : s))
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus()
  return t.toast()
}
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj(); log('X', h.show(p, X))
await t.role('purchasing')
if (mode === 'formal') {
  log('formal F1 →', await t.requestFormal()); p = await t.proj(); log('X formal', h.show(p, X), p.rows.find((r) => r.id === X).status)
  log('import stop S1 →', await importTradable('S1', false))
  p = await t.proj(); const r1 = p.rows.find((r) => r.id === X)
  await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 320)
  log('X after stop', h.show(p, X), 'st', r1.status, 'wd', r1.flags.formalWithdrawn ?? '-', 'fixed', await fixedOf(), '| sb', sb)
  check('L5F-1 正式依頼中の依頼先（因幡）を取引停止にすると、因幡への取下げが購買に出て、依頼先は次の商社（立花）', (r1.flags.formalWithdrawn ?? '').includes('因幡電機') && (await fixedOf()) === 'S2', `wd=${r1.flags.formalWithdrawn} fixed=${await fixedOf()}`)
  check('L5F-2 購買のステータスバーで、取引停止で因幡を外したことと取下げが分かる（客先指定品で「選び直してください」と選定者向けの案内を出さない）', /取引停止/.test(sb) && /取り下げ|取下げ/.test(sb) && !/選び直してください/.test(sb), sb)
  const rq = await h.requestTo('S2'); log('rough S2 →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
  await t.press('6'); log('S2 answer', await h.q(X, 'S2', 400, 10)); await t.press('Escape')
  p = await t.proj(); log('X after S2 answer', h.show(p, X), p.rows.find((r) => r.id === X).status)
  const n0 = t.downloads.length; log('formal F →', await t.requestFormal()); const f0 = await h.files(n0); log('files', JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(X)])))
  check('L5F-3 立花の回答で立花が採用され、正式見積の依頼書が立花に出る', f0.some((f) => f.sup === '立花エレテック' && f.ids.includes(X)), JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(X)])))
  log('import reenable S1 →', await importTradable('S1', true))
  p = await t.proj(); const r2 = p.rows.find((r) => r.id === X); log('X after reenable', h.show(p, X), 'st', r2.status, 'fixed', await fixedOf(), 'wd', r2.flags.formalWithdrawn ?? '-')
  check('L5F-4 因幡を取引可に戻しても、立花の採用・正式依頼中のまま（依頼先が因幡に戻らない）', r2.adoptedSupplierId === 'S2' && r2.status === 'formalRequested' && (await fixedOf()) === 'S2', `${h.show(p, X)} st=${r2.status}`)
} else {
  log('import stop S1 →', await importTradable('S1', false))
  const rq = await h.requestTo('S2'); log('rough S2 →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
  p = await t.proj(); log('X asked S2', h.show(p, X), p.rows.find((r) => r.id === X).status, 'fixed', await fixedOf())
  log('import reenable S1 →', await importTradable('S1', true))
  p = await t.proj(); const r2 = p.rows.find((r) => r.id === X); const f2 = await fixedOf()
  await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 300)
  log('X after reenable', h.show(p, X), 'st', r2.status, 'fixed', f2, '| sb', sb)
  log('INFO 因幡を戻したあとの依頼先', f2, '採用', r2.adoptedSupplierId ?? '-')
  log('INFO L5P-1 立花に頼んで（サンプルは最初から 3 社に依頼済）回答待ちのあいだに因幡を取引可に戻すと、因幡の前の見積で選定済に戻る', r2.adoptedSupplierId === 'S1' && r2.status === 'selected')
  await t.press('6'); log('S2 answer', await h.q(X, 'S2', 400, 10)); await t.press('Escape')
  p = await t.proj(); const r3 = p.rows.find((r) => r.id === X); log('X after S2 answer', h.show(p, X), 'st', r3.status, 'fixed', await fixedOf())
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l5-' + mode)
summary(); await t.close()
