// j1: 正式依頼取下げが 2 つ重なるとき（ラウンド15 の withdrawFormal の印は 1 つだけ）
//   X: 因幡など（ad）に正式依頼 → 別の商社 O の指定商社（ad への取下げ）→ 購買は x せずに O へ正式依頼 → 設計が支給品に（O への取下げ）
//   Y: 同じく ad → 指定商社 O → O へ正式依頼 → 設計が取消（O への取下げ）
//   期待: ad への取下げ（まだ伝えていない）と O への取下げの両方が購買に分かる
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.altPolicy !== '客先承認要' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const [X, Y] = [fr[0].id, fr[1].id]
const ad = Object.fromEntries([X, Y].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
const other = (sid) => (sid === 'S2' ? 'S1' : 'S2')
log('rows', JSON.stringify(ad))
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
for (const id of [X, Y]) { await t.setCellKey(id, 'procurement', '指定商社'); await t.setCellKey(id, 'designated', NAMES[other(ad[id])]) }
log('publish 指定商社 →', await t.publish('1'))
p = await t.proj(); for (const id of [X, Y]) log('after 指定商社', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
const w1 = Object.fromEntries([X, Y].map((id) => [id, p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '']))
check('J1-0 前提: 別の商社の指定商社にした正式依頼中の行に、元の商社への取下げが付く', [X, Y].every((id) => w1[id].includes(NAMES[ad[id]])), JSON.stringify(w1))
// 購買は x を押さずに（まだ伝えていない）新しい指定先へ正式依頼
await t.role('purchasing'); const n0 = t.downloads.length; log('formal to O →', await t.requestFormal()); const f0 = await h.files(n0)
p = await t.proj(); for (const id of [X, Y]) log('after formal O', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id), 'files', JSON.stringify(f0.filter((f) => f.ids.includes(id)).map((f) => f.sup)))
const w2 = Object.fromEntries([X, Y].map((id) => [id, p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '']))
check('J1-1 新しい指定先に正式依頼しても、元の商社への取下げ（未確認）は残る', [X, Y].every((id) => w2[id].includes(NAMES[ad[id]])), JSON.stringify(w2))
// 設計: X を支給品、Y を取消
await t.role('design'); await t.press('1')
log('X → 支給品', await t.setCellKey(X, 'procurement', '支給品'))
await t.goto(Y); await t.press('Shift+Delete'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) } } log('Y delete →', await t.toast())
log('publish →', await t.publish('1'))
p = await t.proj()
const w3 = {}
for (const id of [X, Y]) { const r = p.rows.find((x) => x.id === id); w3[id] = r.flags.formalWithdrawn ?? ''; log('after 支給品/取消', h.show(p, id), 'withdrawn=', w3[id] || '-', '|', await h.status(id)) }
await t.role('purchasing'); await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has X,Y', v4.includes(X), v4.includes(Y))
await t.press('1'); await t.goto(X); await t.press('Home'); const sbX = (await t.status()).slice(0, 220); log('statusbar X', sbX)
// 履歴（イベント）にも元の商社への取下げが残っているか
const ev = p.events.filter((e) => [X, Y].includes(e.rowId) && /取下|取り下げ/.test(e.text)).map((e) => e.text)
log('events with 取下げ', JSON.stringify(ev))
for (const id of [X, Y]) {
  const o = NAMES[other(ad[id])]; const a = NAMES[ad[id]]
  check(`J1-2 ${id}（${id === X ? '支給品' : '取消'}）: 新しい指定先 ${o} への取下げと、まだ伝えていない元の ${a} への取下げの両方が購買に分かる`, w3[id].includes(o) && (w3[id].includes(a) || ev.some((e) => e.includes(a))), `withdrawn=${w3[id]} events=${JSON.stringify(ev)}`)
}
// x を 1 回押したら残りが分かるか
await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); const tx = await t.toast(); p = await t.proj()
log('x X →', tx, '| flag after', p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? '-', '| sb', (await t.status()).slice(0, 160))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j1')
summary(); await t.close()
