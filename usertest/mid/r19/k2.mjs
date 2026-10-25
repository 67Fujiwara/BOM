// k2: 指定商社の指定先（R045 → 立花 S2）を取引停止に（M16-02 の修正: 設計のボール、ステータスバー「指定先 ○○ は取引停止」）
//   正式依頼中（立花 F?）で立花を取引停止 → 購買の取下げ・正式見積の依頼から外れる → 設計が Ctrl+.「指定先を変える」→ 因幡 → 公開
//   → 因幡の見積で選定済 → 購買の正式見積の依頼で因幡に出る
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const X = 'R045'
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj(); log('X before stop', h.show(p, X), '|', await h.status(X))
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S2' ? { ...s, tradable: false } : s)); await t.open('design', ws)
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); const st0 = await h.status(X); const ball0 = await h.ballOf(X)
log('X after stop', h.show(p, X), 'wd', r0.flags.formalWithdrawn ?? '-', '|', st0, 'ball', ball0)
await t.press('4'); const d4 = (await t.viewRows()).includes(X)
await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 300); log('design statusbar', sb)
check('K2-1 指定先が取引停止の行は採用が外れ、設計のボール・設計の 4・ステータスバー「取引停止」', !r0.adoptedSupplierId && ball0 === 'design' && d4 && /取引停止/.test(sb), `adopt=${r0.adoptedSupplierId} ball=${ball0} d4=${d4} sb=${sb.slice(0, 120)}`)
check('K2-2 正式依頼中だった立花への取下げが購買に分かる', /立花/.test(r0.flags.formalWithdrawn ?? ''), r0.flags.formalWithdrawn ?? '-')
// 設計: Ctrl+. の候補
await t.goto(X); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(100); const qf = await t.panel(); log('design Ctrl+. options', JSON.stringify(qf?.options ?? []))
const oi = (qf?.options ?? []).findIndex((o) => /指定先を変える/.test(o))
const label = oi >= 0 ? qf.options[oi] : ''
check('K2-3 Ctrl+.「指定先を変える」の文が取引停止を言う（「取扱なしと回答」と言わない）', /取引停止/.test(label) && !/取扱なしと回答/.test(label), label)
let cand = []
if (oi >= 0) {
  for (let k = 0; k < oi; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.waitForTimeout(100); const pr = await t.panel(); cand = pr?.options ?? []; log('candidates', JSON.stringify(cand))
  check('K2-4 新しい指定先の候補に取引停止の商社（立花エレテック）が出ない', !cand.some((o) => /立花/.test(o)), JSON.stringify(cand))
  const ci = cand.findIndex((o) => o.startsWith('因幡電機'))
  for (let k = 0; k < ci; k++) await t.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(100); if (await t.panel()) await t.press('Escape')
  log('change →', await t.toast())
} else { await t.press('Escape'); log('INFO 指定先を変えるが無い → 手で'); await t.showCol('designated'); log(await t.setCellKey(X, 'designated', '因幡電機')) }
log('publish →', await t.publish('1'))
p = await t.proj(); log('X after change', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'designated', p.rows.find((r) => r.id === X).designated)
await t.role('purchasing')
let n0 = t.downloads.length; let fm = await t.requestFormal(); let f0 = await h.files(n0)
p = await t.proj(); log('formal →', fm, JSON.stringify(f0.filter((f) => f.ids.includes(X)).map((f) => f.sup)), '|', h.show(p, X), '|', await h.status(X))
if (!f0.some((f) => f.ids.includes(X))) {
  // 新しい指定先に概算を頼む必要があるなら
  const rq = await h.requestTo(null); log('rough all →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.includes(X)])))
  p = await t.proj(); log('X', h.show(p, X), '|', await h.status(X))
  if (!p.rows.find((r) => r.id === X).adoptedSupplierId) { await t.press('6'); log('S1 answer', await h.q(X, 'S1', 9000, 10)); await t.press('Escape') }
  n0 = t.downloads.length; fm = await t.requestFormal(); f0 = await h.files(n0)
  p = await t.proj(); log('formal 2 →', fm, JSON.stringify(f0.filter((f) => f.ids.includes(X)).map((f) => f.sup)), '|', h.show(p, X))
}
check('K2-5 指定先を因幡に変えて公開したら、因幡に正式見積の依頼が出る', f0.some((f) => f.sup === '因幡電機' && f.ids.includes(X)) && !f0.some((f) => f.sup === '立花エレテック'), JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(X)])))
const wd = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
check('K2-6 因幡に出したあとも、立花への取下げ（まだ伝えていない）は残る', /立花/.test(wd), wd || '-')
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k2')
summary(); await t.close()
