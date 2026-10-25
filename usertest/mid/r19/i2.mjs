// i2: 修正の対象に入っていない「正式依頼のあとで採用が外れる・行が無くなる」経路で、元の商社への取下げが購買に分かるか
//   (e) 型式の変更（指摘対応でない）→ 再見積 → 別の商社で採用 → 正式依頼
//   (f) 指摘対応の型式変更 → 要再確認 → 採用商社を「再見積」
//   (g) 正式依頼中の行を取消（Shift+Delete → 公開）
//   (h) 正式見積済の行を置換（r → 公開）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.altPolicy !== '客先承認要' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const [E, F, G, H] = [fr[0].id, fr[1].id, fr[2].id, fr[3].id]
const ad = Object.fromEntries([E, F, G, H].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
const fno = (id) => JSON.stringify(p.quotes.filter((q) => q.rowId === id && q.supplierId === ad[id]).map((q) => [q.stale ? 'stale' : 'live', q.formalRequestNo ?? null, q.formalPrice ?? null]))
log('rows', JSON.stringify(ad))
// H は正式見積済に
await t.press('8'); { const q = p.quotes.find((x) => x.rowId === H && x.supplierId === ad[H] && !x.stale); await t.setCellKey(H, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') } await t.press('Escape')
// (f) の準備: 購買が F の型式に「型式あいまい」
await t.press('1'); await t.goto(F); await t.colKey('model'); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('k'); await page.waitForTimeout(60)
await page.getByTestId('issue-text').fill('型式の末尾が不明'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80)
log('issue publish →', await t.publish())
// 設計: E 型式変更（指摘対応でない）、F 指摘対応で型式変更、G 取消、H 置換
await t.role('design'); await t.press('1')
log('E model →', await t.setCellKey(E, 'model', 'NEWMODEL-E1'))
log('F model →', await t.setCellKey(F, 'model', 'FIXED-F2'))
await t.goto(G); await t.press('Shift+Delete'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) } } log('G delete →', await t.toast())
log('H replace →', await t.replace(H, 'REPL-H9'))
p = await t.proj(); const newH = p.rows.find((r) => r.replaceOf === H || r.replacedFrom === H || r.replaces === H)?.id ?? p.rows.filter((r) => r.model === 'REPL-H9').map((r) => r.id)[0]
log('new row for H', newH)
log('publish →', await t.publish('1'))
p = await t.proj()
for (const id of [E, F, G, H]) log('after publish', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id), 'fno', fno(id))
// (f) 購買: 要再確認で採用商社を再見積
await t.role('purchasing'); await t.press('5'); await t.goto(F); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
{ const o = (await t.panel())?.options ?? []; log('F quickfix', JSON.stringify(o)); const i = o.findIndex((x) => x.includes(`要再確認 ${NAMES[ad[F]]}: 再見積`)); if (i >= 0) { for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120) } else await t.press('Escape') }
log('F reconfirm →', await t.toast())
p = await t.proj(); log('F after', h.show(p, F), 'withdrawn=', p.rows.find((r) => r.id === F).flags.formalWithdrawn ?? '-', '|', await h.status(F), 'fno', fno(F))
const wd = (id) => p.rows.find((r) => r.id === id).flags.formalWithdrawn
await t.press('4'); const v4 = await t.viewRows(); await t.press('8'); const v8 = await t.viewRows()
log('purch 4 has E,F,G,H', JSON.stringify([E, F, G, H].map((id) => v4.includes(id))), '8 has', JSON.stringify([E, F, G, H].map((id) => v8.includes(id))))
check('I2-1 (f) 指摘対応の型式変更 → 要再確認で採用商社を「再見積」にして採用が外れた正式依頼中の行に「正式依頼取下げ」', !!wd(F), `${h.show(p, F)} | ${await h.status(F)} | fno=${fno(F)}`)
check('I2-2 (g) 正式依頼中の行を取消したら、元の商社への正式依頼の取下げが購買に分かる（取下げの印・4・8 のどれか）', !!wd(G) || v4.includes(G) || v8.includes(G), `${h.show(p, G)} | ${await h.status(G)} | fno=${fno(G)} | in4=${v4.includes(G)} in8=${v8.includes(G)}`)
check('I2-3 (h) 正式見積済の行を置換したら、元の商社への正式依頼の取下げが購買に分かる', !!wd(H) || v4.includes(H) || v8.includes(H), `${h.show(p, H)} | ${await h.status(H)} | fno=${fno(H)} | in4=${v4.includes(H)} in8=${v8.includes(H)}`)
// (e) 型式変更の行: 再見積 → 3 社回答 → 元の商社以外を採用 → 正式依頼
const r1 = await h.requestTo(null); log('rough all →', r1.msg)
await t.press('6'); const others = ['S1', 'S2', 'S3']; const prices = { [ad[E]]: 900 }; for (const sid of others) { if (!prices[sid]) prices[sid] = sid === (ad[E] === 'S2' ? 'S1' : 'S2') ? 500 : 800; log('q', E, sid, await h.q(E, sid, prices[sid], 1)) }
await t.press('Escape')
p = await t.proj(); log('E quoted', h.show(p, E), '|', await h.status(E))
await t.role('design'); await t.press('1'); await t.goto(E); await t.press('a'); await page.waitForTimeout(80); log('E a →', await t.toast())
await t.role('purchasing'); const n0 = t.downloads.length; log('formal again →', await t.requestFormal()); const f = await h.files(n0)
p = await t.proj(); const rE = p.rows.find((r) => r.id === E)
log('E after formal', h.show(p, E), 'withdrawn=', rE.flags.formalWithdrawn ?? '-', '|', await h.status(E), 'files', JSON.stringify(f.map((x) => [x.sup, x.ids.includes(E)])), 'old fno', fno(E))
check('I2-4 (e) 型式変更で採用が外れ、別の商社（' + NAMES[rE.adoptedSupplierId] + '）に正式依頼したとき、元の商社（' + NAMES[ad[E]] + '）への正式依頼の取下げが購買に分かる', rE.adoptedSupplierId === ad[E] || !!rE.flags.formalWithdrawn, `adopt=${rE.adoptedSupplierId} withdrawn=${rE.flags.formalWithdrawn} files=${JSON.stringify(f.map((x) => [x.sup, x.ids.includes(E)]))}`)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i2')
summary(); await t.close()
