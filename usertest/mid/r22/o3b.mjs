// o3b: 発注済・入荷済の行の調達区分、発注を外したあとの切り替え、客先指定品／指定商社 ⇄ 相見積の戻し
//   各段階の状態を記録し、次を確かめる
//    B1 発注済・入荷済の行は設計が調達区分を変えられない（発注後変更依頼で扱う）
//    B2 発注を外した行（正式見積済に戻る）を支給品にすると、採用・正式見積・発注数が残らず、総額から外れる
//    B3 客先指定品を相見積に戻すと、指定先（固定）の採用は外れ、見積済みの別商社も候補になる
//    B4 指定商社の指定先を取引停止の商社に変えたら採用が外れる（次の商社には自動で行かない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
const adq = (p, id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
async function formalAnswer(id, lead) { const p = await t.proj(); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(adq(p, id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', String(lead)); await t.press('Escape') }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const base = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && !r.needDateFixed && r.qtyNeeded >= 3)
const [O, V, W] = [base[0].id, base[1].id, base[2].id]
for (const id of [O, V]) await formalAnswer(id, 10)
await t.press('Escape'); log('order O', await t.order(O))
p = await t.proj(); log('O', h.show(p, O).slice(0, 160))
const sw = async (id, vals, label) => {
  await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement'); const msgs = []
  for (const [k, v] of Object.entries(vals)) msgs.push(await t.setCellKey(id, k, v))
  const pub = (await t.publish('1')).slice(0, 90); p = await t.proj(); log(label, JSON.stringify(msgs).slice(0, 200), '| publish', pub, '|', h.show(p, id).slice(0, 220)); return p.rows.find((r) => r.id === id)
}
// B1
const rO = await sw(O, { procurement: '支給品' }, 'B1 発注済 O → 支給品')
check('O3B-1 発注済の行は設計が調達区分を変えられない（支給品にならず、発注済のまま）', rO.procurement === '相見積' && rO.status === 'ordered', `${rO.procurement} ${rO.status}`)
// B2: V（正式見積済）を支給品へ
const rV = await sw(V, { procurement: '支給品' }, 'B2 正式見積済 V → 支給品')
check('O3B-2a V（正式見積済）を支給品にすると採用・正式単価・発注数が残らない', !rV.adoptedSupplierId && rV.procurement === '支給品' && !p.quotes.some((q) => q.rowId === V && !q.stale && q.formalPrice != null && rV.adoptedSupplierId), h.show(p, V).slice(0, 200))
const fq = p.quotes.filter((q) => q.rowId === V && !q.stale && q.formalPrice != null)
check('O3B-2b 支給品にした行に生きた正式単価が残らない（総額・Excel の正式単価に出ない）', fq.length === 0, JSON.stringify(fq.map((q) => [q.supplierId, q.formalPrice])))
await t.role('purchasing'); await t.press('3'); const in3 = (await t.viewRows()).includes(V); const ord = await t.order(V); log('V 発注を試す →', ord)
check('O3B-2c 支給品の行は購買が発注にできない', /支給品|発注できません|権限|商社/.test(ord) && (await t.row(V)).status !== 'ordered', ord)
// 戻す
const rV2 = await sw(V, { procurement: '相見積' }, 'B2b V → 相見積に戻す')
check('O3B-2d 相見積に戻した V は発注済・正式依頼中などの古い状態に戻らない', !['ordered', 'received', 'formalRequested', 'formalQuoted'].includes(rV2.status), rV2.status)
// B3 客先指定品 W → 相見積 戻し
const rW1 = await sw(W, { procurement: '客先指定品', designated: 'フエニックス A-123' }, 'B3 W → 客先指定品')
const rW2 = await sw(W, { procurement: '相見積' }, 'B3b W → 相見積に戻す')
check('O3B-3 客先指定品から相見積に戻すと、指定先（固定）の採用理由が残らない', rW2.adoptReason !== '指定先（固定）', h.show(p, W).slice(0, 200))
check('O3B-3b 戻した W は採用なしの選定済のまま残らない', !(['selected', 'formalRequested', 'formalQuoted'].includes(rW2.status) && !rW2.adoptedSupplierId), rW2.status)
// 指定商社: 取引停止にした商社を指定
const ws = await t.ws(); const stopSid = 'S3'
await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
ws.suppliers = ws.suppliers.map((s) => (s.id === stopSid ? { ...s, tradable: false } : s))
await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
const sname = ws.suppliers.find((s) => s.id === stopSid).name
const rW3 = await sw(W, { procurement: '指定商社', designated: sname }, `B4 W → 指定商社(取引停止の ${sname})`)
check('O3B-4 取引停止の商社を指定先にした指定商社の行は、その商社で選定済にならない', rW3.adoptedSupplierId !== stopSid, h.show(p, W).slice(0, 200))
log('W ball', await h.ballOf(W), 'in9', await h.inView('purchasing', 9, W))
log('ERRORS', JSON.stringify(t.errors)); check('O3B-5 console error なし', t.errors.length === 0, JSON.stringify(t.errors).slice(0, 300)); summary(); await t.close()
