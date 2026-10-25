// l4: 取下げが 2 つ積まれた行の x（U17-01 の修正「1 回で 1 社、どの商社・依頼No か、残りも知らせる」）と Ctrl+Z、購買の 9 と F8（N17-09）
//   因幡/立花 に正式依頼 → 指定商社（もう一方）→ 正式依頼 → 支給品（2 つの取下げ）
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
await t.role('design'); await t.press('1'); log('X → 支給品', await t.setCellKey(X, 'procurement', '支給品')); log('publish →', await t.publish('1'))
p = await t.proj(); const wd0 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('wd', wd0)
check('L4-0 取下げが 2 つ積まれる', wd0.includes(NAMES[ad]) && wd0.includes(NAMES[O]), wd0)
// 購買の既定のビュー 9 と F8
await t.role('purchasing'); await t.press('9'); const in9 = (await t.viewRows()).includes(X); log('purch 9 has X', in9)
check('L4-1 購買の 9 に取下げのある行（支給品に変えた行）が出る（N17-09）', in9)
await t.goto(X); await t.press('Home'); const sb0 = (await t.status()).slice(0, 300); log('purch 9 statusbar', sb0)
// 9 の先頭から F8 で X に着くか
await page.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ cursorRow: null }) })
let hit = false; const seen = []
for (let i = 0; i < 40; i++) { await t.press('F8'); const r = await t.curRow(); seen.push(r); if (r === X) { hit = true; break } }
log('F8 seq', seen.slice(0, 12).join(','), '... hit', hit)
check('L4-2 購買の 9 で F8 を押していくと取下げのある行に着く（N17-09）', hit, seen.join(','))
// x 1 回目
await t.goto(X); await t.press('Home'); await t.press('x'); await page.waitForTimeout(120); const tx1 = await t.toast()
p = await t.proj(); const wd1 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('x1 →', tx1, '| rest', wd1)
const first = wd0.split(' / ')[0], second = wd0.split(' / ')[1]
check('L4-3 x 1 回で 1 社分だけ消え、知らせに消した商社・依頼No と残りが出る（U17-01）', wd1 === second && tx1.includes(first) && tx1.includes(second) && /残り 1 件/.test(tx1), `toast=${tx1} rest=${wd1}`)
const sb1 = (await t.status()).slice(0, 300); log('statusbar after x1', sb1)
check('L4-4 ステータスバーに残りの取下げ先が出る', sb1.includes(second.split(' ')[0]), sb1)
// x 2 回目
await t.press('x'); await page.waitForTimeout(120); const tx2 = await t.toast(); p = await t.proj(); const wd2 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('x2 →', tx2, '| rest', wd2 || '-')
check('L4-5 x 2 回目で残りの 1 社が消え、知らせにその商社が出る（「残り」は出ない）', !wd2 && tx2.includes(second) && !/残り/.test(tx2), `toast=${tx2} rest=${wd2}`)
// Ctrl+Z 1 回 → 2 回目の分だけ戻る、もう 1 回 → 2 つとも
await t.press('Control+z'); await page.waitForTimeout(150); p = await t.proj(); const wz1 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
await t.press('Control+z'); await page.waitForTimeout(150); p = await t.proj(); const wz2 = p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
log('Ctrl+Z ×1', wz1, '| ×2', wz2)
check('L4-6 Ctrl+Z 1 回で最後に消した 1 社分、2 回で 2 社分が戻る', wz1 === second && wz2 === wd0, `z1=${wz1} z2=${wz2}`)
// 9 で x した行が 9 から外れる（取下げを伝え終えた支給品の行は購買の作業ではない）
await t.press('x'); await t.press('x'); await page.waitForTimeout(100); await t.press('9'); const in9b = (await t.viewRows()).includes(X); log('purch 9 has X after both x', in9b)
check('L4-7 取下げを 2 つとも伝えたら、支給品の行は購買の 9 から外れる', !in9b)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l4')
summary(); await t.close()
