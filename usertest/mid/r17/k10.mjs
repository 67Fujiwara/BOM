// k10: 2 タブ。タブ B（購買）がミスミを取引停止にした JSON を読み込む（M16-03 の修正: 読み込み時に整える）
//   (a) タブ A（購買）が「正式見積を依頼」の確認パネルを開いたまま → B が読み込み → A が確定: ミスミに依頼書を出さない
//   (b) A の画面でミスミ採用の行が選び直し（採用なし）に変わり、A の 4・ステータスバーで分かる
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const M = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積' && !r.flags.pmPending).map((r) => r.id)
log('ミスミ採用', JSON.stringify(M))
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s))
// タブ B
const p2 = await context.newPage()
await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-purchasing').click(); await p2.locator('.gridwrap').focus()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
// A: 確認パネルを開く
await t.role('purchasing'); await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(150); const pn = await t.panel(); log('A panel', pn?.title)
// B: JSON を読み込む
await p2.keyboard.press('Control+k'); await p2.getByTestId('palette-input').fill('JSON を読み込む'); await p2.waitForTimeout(100); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150)
await p2.getByTestId('import-text').fill(JSON.stringify(ws)); await p2.getByTestId('import-text').press('Control+Enter'); await p2.waitForTimeout(250)
for (let g = 0; g < 3; g++) { const opts = await S2('return st.panel ? (st.panel.options ?? []).map((o) => typeof o === "string" ? o : o.label) : null'); if (!opts) break; const i = opts.findIndex((o) => /置き換える/.test(o)); for (let k = 0; k < i; k++) await p2.keyboard.press('ArrowDown'); await p2.keyboard.press('Enter'); await p2.waitForTimeout(250) }
log('B import →', await S2('return st.toast?.text ?? ""'), 'B S3 tradable', await S2('return st.ws.suppliers.find((s) => s.id === "S3").tradable'))
await page.waitForTimeout(800)
log('A S3 tradable', await t.S('return st.ws.suppliers.find((s) => s.id === "S3").tradable'), 'A panel still', (await t.panel())?.title)
const n0 = t.downloads.length; await t.press('2'); await page.waitForTimeout(1500); const ma = await t.toast(); const fa = await h.files(n0)
p = await t.proj(); log('A confirm →', ma, JSON.stringify(fa.map((f) => [f.sup, f.ids.length])))
check('K10-1 別のタブでミスミを取引停止にした直後、開いていた確認パネルから確定してもミスミに依頼書を出さない', !fa.some((f) => f.sup === 'ミスミ'), JSON.stringify(fa.map((f) => [f.sup, f.ids.length])))
const after = M.map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.adoptedSupplierId ?? null, r.flags.formalWithdrawn ?? null] })
log('ミスミ採用だった行', JSON.stringify(after))
check('K10-2 ミスミ採用だった行は採用が外れ、ミスミへの取下げを出す用事も無い（出していないので）', after.every(([, , a, w]) => a !== 'S3' && !(w ?? '').includes('ミスミ')), JSON.stringify(after))
await t.press('4'); const v4 = await t.viewRows(); log('A purch 4 has M[0]', v4.includes(M[0]))
await t.role('design'); await t.press('4'); const d4 = await t.viewRows(); log('A design 4 has M', JSON.stringify(M.map((id) => d4.includes(id))))
check('K10-3 採用が外れた行が選定者（設計）の 4 に出る', M.every((id) => d4.includes(id)), JSON.stringify(M.map((id) => d4.includes(id))))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k10')
summary(); await t.close()
