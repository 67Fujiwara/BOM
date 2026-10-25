// k11: 指定商社の行で、指定先 1 社の回答が辞退（または指定先が取引停止）のあと、購買が「概算見積を依頼 → 相見積先すべて」
//   §3.4・§7「指定商社・客先指定品の行は指定先 1 社にだけ依頼」。M16-07 の修正（全社辞退の行をほかの商社に頼める）が指定系に効かないか
//   mode=decline: 指定先（立花）が取扱なし   mode=stop: 指定先（立花）を取引停止（回答あり）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'decline'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const X = await h.addRow('R010', '指定品テスト', 'K11-' + mode.toUpperCase() + '-1', 'オムロン', '指定商社', '立花エレテック', '3')
log('X', X, 'publish →', await t.publish('1'))
await t.role('purchasing'); const r1 = await h.requestTo('S2'); log('rough S2 →', r1.msg, JSON.stringify(r1.f.map((f) => [f.sup, f.ids.includes(X)])))
let p = await t.proj(); log('X', h.show(p, X), '|', await h.status(X))
if (mode === 'decline') { log('S2 decline', await h.decline(X, 'S2')) }
else {
  await t.press('6'); log('S2 answer', await h.q(X, 'S2', 5000, 10)); await t.press('Escape')
  p = await t.proj(); log('X answered', h.show(p, X), '|', await h.status(X))
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S2' ? { ...s, tradable: false } : s)); await t.open('purchasing', ws)
}
p = await t.proj(); log('X now', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X))
await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(100); const qf = (await t.panel())?.options ?? []; await t.press('Escape'); log('purch Ctrl+. X', JSON.stringify(qf))
check('K11-1 指定商社の行の購買の Ctrl+. に「ほかの商社に依頼する」（指定先以外への依頼）を出さない', !qf.some((o) => /ほかの商社に依頼/.test(o)), JSON.stringify(qf))
const ra = await h.requestTo(null); log('rough all →', ra.msg, JSON.stringify(ra.f.map((f) => [f.sup, f.ids.includes(X)])))
p = await t.proj(); log('X after all', h.show(p, X), '|', await h.status(X), 'targets', JSON.stringify(p.rows.find((r) => r.id === X).quoteTargets ?? null))
check('K11-2 「相見積先すべて」で、指定商社の行を指定先以外の商社（因幡・ミスミ）に頼まない（指定先を変えるのは設計）', !ra.f.some((f) => f.ids.includes(X) && f.sup !== '立花エレテック'), JSON.stringify(ra.f.map((f) => [f.sup, f.ids.includes(X)])))
check('K11-3 行は設計のボール（指定先を変える）のまま', (await h.ballOf(X)) === 'design', String(await h.ballOf(X)))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k11-' + mode)
summary(); await t.close()
