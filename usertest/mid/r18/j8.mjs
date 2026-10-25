// j8: 2 タブ（同じブラウザ）
//   (a) A=購買が「正式見積を依頼」の確認パネルを開いたまま、B=設計が選定済の行 X を支給品・行 T を取消にして公開 → A が確定
//   (b) A=購買が 4 を開いたまま、B=設計が正式依頼中の行 G を取消して公開 → A の 4 に G（取下げ）が出て、A の x で外れ、B にも伝わる
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const sel = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending)
const X = sel[0].id, T = sel[1].id, G = sel[2].id
log('X', X, 'T', T, 'G', G)
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
await t.role('purchasing'); await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(120); const pn = await t.panel(); log('A panel', pn?.title)
await set2(X, 'procurement', '支給品'); await goto2(T); await p2.keyboard.press('Shift+Delete'); await p2.waitForTimeout(100); if (await S2('return st.panel ? 1 : 0')) { await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
log('B publish X 支給品 / T 取消 →', await publish2()); await page.waitForTimeout(500)
const n0 = t.downloads.length; await t.press('2'); await page.waitForTimeout(1500); const ma = await t.toast(); const fa = await h.files(n0)
p = await t.proj(); log('A confirm →', ma, JSON.stringify(fa.map((f) => [f.sup, f.ids.includes(X), f.ids.includes(T), f.ids.length])))
for (const id of [X, T, G]) log('after (a)', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
check('J8-1 別のタブで支給品にした行・取消した行は、開いていた確認パネルからの正式見積の依頼書に入らない', !fa.some((f) => f.ids.includes(X) || f.ids.includes(T)), JSON.stringify(fa.map((f) => [f.sup, f.ids.includes(X), f.ids.includes(T)])))
check('J8-2 その 2 行に、出していない正式依頼の「取下げ」は付かない', ![X, T].some((id) => p.rows.find((r) => r.id === id).flags.formalWithdrawn), JSON.stringify([X, T].map((id) => p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? null)))
// (b)
await t.press('4'); const v4a = await t.viewRows(); log('A 4 has G before', v4a.includes(G), h.show(p, G))
await goto2(G); await p2.keyboard.press('Shift+Delete'); await p2.waitForTimeout(100); if (await S2('return st.panel ? 1 : 0')) { await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
log('B publish G 取消 →', await publish2()); await page.waitForTimeout(600)
const v4b = await t.viewRows(); p = await t.proj(); log('A 4 has G after', v4b.includes(G), h.show(p, G), 'withdrawn', p.rows.find((r) => r.id === G).flags.formalWithdrawn ?? '-')
check('J8-3 別のタブで取消した正式依頼中の行が、開いている購買の 4 に取下げで出る', v4b.includes(G) && !!p.rows.find((r) => r.id === G).flags.formalWithdrawn, `in4=${v4b.includes(G)}`)
await t.goto(G); await t.press('Home'); await t.press('x'); await page.waitForTimeout(150); const xa = await t.toast(); await p2.waitForTimeout(500)
const wb = await S2(`return p.rows.find((r) => r.id === '${G}').flags.formalWithdrawn ?? null`)
log('A x →', xa, '| B sees flag', wb)
check('J8-4 A の x で外した取下げは B にも伝わる', wb == null, String(wb))
const e2 = []; p2.on('pageerror', (e) => e2.push(e.message))
log('ERRORS', JSON.stringify(t.errors), JSON.stringify(e2))
await t.shot('j8')
summary(); await t.close()
