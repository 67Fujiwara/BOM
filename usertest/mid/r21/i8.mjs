// i8: 2 タブ（同じブラウザ）。round14 の修正の周り
//   (a) A=購買が再見積の依頼パネルを開いたまま、B=設計がその行を支給品にして公開 → A が Enter
//   (b) A=PM が差分超過の行の決定パネルを開いたまま、B=設計がその行を別の商社の指定商社にして公開 → A が b（次点）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const nextOk = async (id) => page.evaluate(async (id) => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return !!m.nextBest(p, p.rows.find((x) => x.id === id), s.ws.suppliers) }, id)
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[1].id; let D = null; for (const r of fr.slice(3)) if (await nextOk(r.id)) { D = r.id; break }
const ad = Object.fromEntries([Y, D].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
await t.press('8')
{ const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === ad[Y] && !x.stale); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
{ const r = p.rows.find((x) => x.id === D); const q = p.quotes.find((x) => x.rowId === D && x.supplierId === ad[D] && !x.stale); await t.setCellKey(D, 'q.formalPrice@A', String(q.unitPrice + Math.ceil(40000 / Math.max(1, r.orderQty ?? r.qtyNeeded)))); await t.press('Escape') }
await t.press('Escape')
await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === Y).qtyNeeded; await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3)); log('publish qty →', await t.publish('2'))
p = await t.proj(); for (const id of [Y, D]) log('setup', h.show(p, id), '|', await h.status(id))
// タブ B
const p2 = await context.newPage()
await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-design').click(); await p2.locator('.gridwrap').focus()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
async function col2(key) { for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowRight') } for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowLeft') } }
async function set2(id, col, v) { await goto2(id); await col2(col); await p2.keyboard.press('Enter'); await p2.waitForTimeout(40); await p2.keyboard.press('Control+a'); await p2.keyboard.type(v); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) }
async function publish2() { await p2.keyboard.press('Control+Enter'); await p2.waitForTimeout(150); for (let g = 0; g < 3; g++) { const pn = await S2('const x = st.panel; return x ? x.kind : null'); if (!pn) break; if (g === 0) await p2.keyboard.press('1'); await p2.waitForTimeout(60); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) } return S2('return st.toast?.text ?? ""') }
await p2.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ hiddenCols: s.getState().hiddenCols.filter((k) => !['procurement', 'designated'].includes(k)) }) })
await p2.keyboard.press('1')
// (a)
await t.role('purchasing'); await t.press('9'); await t.goto(Y); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
{ const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes('再見積（概算見積を依頼）')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150) }
log('A panel', (await t.panel())?.title)
await set2(Y, 'procurement', '支給品'); log('B publish Y 支給品 →', await publish2()); await page.waitForTimeout(400)
const n0 = t.downloads.length; await t.press('Enter'); await page.waitForTimeout(1300); const ma = await t.toast(); const fa = await h.files(n0)
p = await t.proj(); log('A Enter →', ma, JSON.stringify(fa.map((f) => [f.sup, f.ids.includes(Y)])), '|', h.show(p, Y), 'withdrawn', p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? '-', '|', await h.status(Y))
check('I8-1 別のタブで支給品になった行には、開いていた再見積のパネルから依頼書を出さない', !fa.some((f) => f.ids.includes(Y)) && p.rows.find((r) => r.id === Y).procurement === '支給品', `${ma} / ${JSON.stringify(fa.map((f) => [f.sup, f.ids.includes(Y)]))}`)
// (b)
await t.role('pm'); await t.press('7'); await t.goto(D); await t.press('Enter'); await page.waitForTimeout(100); log('A decision panel', JSON.stringify((await t.panel())?.options ?? []))
const other = ad[D] === 'S2' ? 'S3' : 'S2'
await set2(D, 'procurement', '指定商社'); await set2(D, 'designated', NAMES[other]); log('B publish D 指定商社 →', await publish2()); await page.waitForTimeout(400)
await t.press('b'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('次点へ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } }
const mb = await t.toast(); const pn = await t.panel(); if (pn) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape') }
p = await t.proj(); const rD = p.rows.find((r) => r.id === D); log('A b →', mb, '| panel', JSON.stringify(pn?.error ?? pn?.title ?? null), '|', h.show(p, D), '|', await h.status(D), 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === D).map((d) => d.kind)))
check('I8-2 別のタブで指定商社に変わった行に、開いていた決定パネルの「次点へ」を適用しない（指定先のまま）', rD.procurement === '指定商社' && (rD.adoptedSupplierId == null || rD.adoptedSupplierId === other) && !p.decisions.some((d) => d.rowId === D && d.kind === '次点商社へ'), `${mb} / ${h.show(p, D)}`)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i8')
summary(); await t.close()
