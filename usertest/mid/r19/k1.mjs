// k1: 正式依頼取下げが積み重なる（M16-01 の修正「商社 依頼No / 商社 依頼No」）の先
//   ad に正式依頼 → 指定商社 O（ad への取下げ）→ x せずに O へ正式依頼 → 支給品（O への取下げ。2 つ）
//   → ステータスバー・x（1 回で何が消えるか）・Ctrl+Z・相見積に戻して同じ商社に出し直したとき、その商社の分だけ外れるか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && ['S1', 'S2'].includes(r.adoptedSupplierId) && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.altPolicy !== '客先承認要' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const X = fr[0].id; const ad = fr[0].adoptedSupplierId; const O = ad === 'S2' ? 'S1' : 'S2'
log('X', h.show(p, X), 'ad', ad, 'O', O)
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
await t.setCellKey(X, 'procurement', '指定商社'); await t.setCellKey(X, 'designated', NAMES[O])
log('publish 指定商社 →', await t.publish('1'))
await t.role('purchasing'); log('formal to O →', await t.requestFormal())
p = await t.proj(); log('after formal O', h.show(p, X), 'wd=', p.rows.find((r) => r.id === X).flags.formalWithdrawn)
await t.role('design'); await t.press('1'); log('X → 支給品', await t.setCellKey(X, 'procurement', '支給品')); log('publish →', await t.publish('1'))
p = await t.proj(); const wd = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('after 支給品', h.show(p, X), 'wd=', wd, '|', await h.status(X))
check('K1-1 取下げの印に元の商社と新しい指定先の 2 つが残る（M16-01）', wd.includes(NAMES[ad]) && wd.includes(NAMES[O]), wd)
await t.role('purchasing'); await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 260); log('purch statusbar', sb)
check('K1-2 購買のステータスバーに 2 つの取下げ先（商社名・依頼No）が出る', sb.includes(NAMES[ad]) && sb.includes(NAMES[O]), sb)
await t.press('4'); const in4 = (await t.viewRows()).includes(X); await t.press('8'); const in8 = (await t.viewRows()).includes(X); log('purch 4/8 has X', in4, in8)
await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('x'); await page.waitForTimeout(100); const tx = await t.toast()
p = await t.proj(); const wd1 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('x →', tx, '| wd after', wd1 || '-', '| sb', (await t.status()).slice(0, 200))
// x を 1 回押して 2 社分が消えるなら、知らせに 2 社とも出ているべき（どちらに伝えたかが分からない）
check('K1-3 x 1 回で消えた取下げ先が知らせに出る（1 社ずつ消える、または 2 社の名前が出る）', (wd1 && (wd1.includes(NAMES[ad]) !== wd1.includes(NAMES[O]))) || (tx.includes(NAMES[ad]) && tx.includes(NAMES[O])), `toast=${tx} rest=${wd1}`)
await t.press('Control+z'); await page.waitForTimeout(120); p = await t.proj(); const wdz = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('Ctrl+Z →', await t.toast(), 'wd', wdz)
check('K1-4 Ctrl+Z で 2 つの取下げが戻る', wdz.includes(NAMES[ad]) && wdz.includes(NAMES[O]), wdz)
// 設計が相見積に戻す → 選定者が ad を選ぶ → 購買が ad に正式依頼 → ad の取下げだけ外れ、O の取下げは残る
await t.role('design'); await t.press('1'); log('X → 相見積', await t.setCellKey(X, 'procurement', '相見積')); log('publish →', await t.publish('1'))
p = await t.proj(); log('X back', h.show(p, X), '|', await h.status(X))
const ranks = await page.evaluate(async (X) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === X); const res = sc.scoreRow(p, r, s.ws.suppliers); return (res.ranked ?? res).map?.((x) => x.supplierId) ?? JSON.stringify(res).slice(0, 200) }, X).catch((e) => 'ERR ' + e.message)
log('ranks', JSON.stringify(ranks))
const n = Array.isArray(ranks) ? ranks.indexOf(ad) + 1 : 1
const ap = await h.adoptPick(X, n, '6', '元の商社に戻す'); log('adopt pick', n, '→', ap.toast)
p = await t.proj(); log('X adopted', h.show(p, X), '|', await h.status(X))
const rX = p.rows.find((r) => r.id === X)
if (rX.flags.pmPending) { await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(X, 'ok')).toast) }
await t.role('purchasing'); const n0 = t.downloads.length; log('formal to ad →', await t.requestFormal()); const f0 = await h.files(n0)
p = await t.proj(); const wd2 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('after formal to ad', h.show(p, X), 'wd', wd2 || '-', 'files', JSON.stringify(f0.filter((f) => f.ids.includes(X)).map((f) => f.sup)))
if (p.rows.find((r) => r.id === X).adoptedSupplierId === ad && f0.some((f) => f.ids.includes(X))) {
  check('K1-5 同じ商社（元の商社）に出し直したら、その商社の取下げだけ外れ、別の商社（O）への取下げは残る', !wd2.includes(NAMES[ad]) && wd2.includes(NAMES[O]), wd2)
} else log('INFO K1-5 の前提が成立せず（採用', p.rows.find((r) => r.id === X).adoptedSupplierId, '）')
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k1')
summary(); await t.close()
