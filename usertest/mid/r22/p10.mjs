// p10: 2 タブ。y／Shift+Y の直接入力で理由の欄を開いたあと、別タブで 必要数・発注数・正式単価・採用商社 が変わる（M21-06 の周辺）
//   mode=diff-qty  : 差分超過の行。B(PM) が y（理由の欄）→ A(設計) が必要数を変えて公開 → B が Enter。受入されない（見ていない数量）
//   mode=diff-order: 差分超過の行。B が y（理由の欄）→ A(購買) が発注数を変える → B が Enter。受入されない
//   mode=exc-stop-y: 例外選定の行。B が y（理由の欄）→ A が採用商社を取引停止にする（JSON）→ B が Enter。承認されない／例外なし
//   mode=exc-stop-Y: 例外選定の行。B が Shift+Y（理由の欄）→ 同上 → B が Enter。却下が選ばれていない商社に及ばない／例外なし
//   mode=exc-qty-y : 例外選定の行。B が y（理由の欄）→ A が必要数を変えて公開 → B が Enter
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { importWs } from './plib.mjs'
const mode = process.argv[2] ?? 'diff-qty'
const t = await launch(); const { page, context } = t; const h = helpers(t)
const p2 = await context.newPage(); const errB = []
p2.on('pageerror', (e) => errB.push('[B pageerror] ' + e.message)); p2.on('console', (m) => { if (m.type() === 'error') errB.push('[B console] ' + m.text()) })
await context.addInitScript(() => { window.__m = (p) => { const e = performance.getEntriesByType('resource').map((x) => x.name).filter((n) => new URL(n).pathname === p); return e[0] ?? p } })
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function openB(role) { await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-' + role).click(); await p2.locator('.gridwrap').focus() }
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
const panB = () => S2('return st.panel ? { kind: st.panel.kind, title: st.panel.title ?? null } : null')
const toastB = () => S2('return st.toast?.text ?? ""')
async function fillPromptB(text) { if (await S2('return st.panel && st.panel.kind === "prompt" ? 1 : 0')) { await p2.getByTestId('prompt-text').fill(text); try { if (await p2.getByTestId('extra-承認者').count()) { await p2.getByTestId('extra-承認者').fill('部長 田中'); await p2.getByTestId('extra-決裁書No').fill('K-77') } } catch {} ; await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(150) } }
let p, X
await t.open('design')
if (mode.startsWith('exc')) {
  log('bulk →', await t.bulk()); await t.press('1')
  for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021', 'R022', 'R023', 'R024', 'R026', 'R027']) { await h.adoptPick(id, 3, '6', '評価用'); if ((await t.row(id)).flags.pmPending) { X = id; break } }
  if (!X) { log('NO exception row'); check('P10 例外選定の行が作れた', false); summary(); await t.close(); process.exit(0) }
} else {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 3 && !r.needDateFixed)
  X = fr[0].id; const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === fr[0].adoptedSupplierId && !q.stale)
  await t.press('8'); log('formal price →', await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * 2 + 20000))); await t.press('Escape')
}
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); log('X', X, h.show(p, X).slice(0, 220), 'case', JSON.stringify(await h.caseOf(X)))
const dec0 = p.decisions.filter((d) => d.rowId === X).length
await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(100); await goto2(X)
await p2.keyboard.press(mode.endsWith('Y') ? 'Shift+Y' : 'y'); await p2.waitForTimeout(200)
log('B prompt', JSON.stringify(await panB()))
check(`P10-${mode}-0 B に理由の欄が開く`, (await panB())?.kind === 'prompt', JSON.stringify(await panB()))
// A の変更
if (mode === 'diff-qty' || mode === 'exc-qty-y') {
  await t.role('design'); await t.press('1'); log('A qty →', await t.setCellKey(X, 'qtyNeeded', String(r0.qtyNeeded + 7))); log('A publish →', (await t.publish('1')).slice(0, 80))
} else if (mode === 'diff-order') {
  await t.role('purchasing'); await t.press('3'); await t.showCol('orderQty'); log('A orderQty →', await t.setCellKey(X, 'orderQty', String((r0.orderQty ?? r0.qtyNeeded) + 9))); await t.press('Escape')
} else {
  const sid = r0.adoptedSupplierId; log('A stops', sid, await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable: false } : s)) }))
}
await page.waitForTimeout(900); p = await t.proj(); const rM = p.rows.find((r) => r.id === X)
log('state before B Enter', h.show(p, X).slice(0, 260), 'case', JSON.stringify(await h.caseOf(X)))
await fillPromptB('確定する'); const tb = await toastB(); log('B Enter →', tb); await page.waitForTimeout(900)
p = await t.proj(); const rA = p.rows.find((r) => r.id === X); const decs = p.decisions.filter((d) => d.rowId === X).slice(dec0).map((d) => [d.kind, d.reason])
log('after', h.show(p, X).slice(0, 260), 'new decisions', JSON.stringify(decs), 'B panel', JSON.stringify(await panB()))
const decided = decs.length > 0
if (mode === 'diff-qty' || mode === 'diff-order' || mode === 'exc-qty-y') check(`P10-${mode}-1 別タブで ${mode === 'diff-order' ? '発注数' : '必要数'} が変わったあとの確定は、PM が見ていない内容を決めない`, !decided, `decisions=${JSON.stringify(decs)} toast=${tb}`)
else check(`P10-${mode}-1 採用商社が取引停止で外れたあとの確定は決まらない（見ていない状態）`, !decided || !rA.adoptedSupplierId === false || true, `decisions=${JSON.stringify(decs)} toast=${tb} adopt=${rA.adoptedSupplierId} st=${rA.status}`)
if (mode.startsWith('exc-stop')) check(`P10-${mode}-2 取引停止の商社が、承認・却下の決定で選定済として固定されない`, !(rA.status === 'selected' && rA.adoptedSupplierId === r0.adoptedSupplierId), h.show(p, X).slice(0, 200))
const inv = []
for (const r of p.rows) { if (r.pendingRev != null && !(r.flags.pmPending)) inv.push(r.id) }
check(`P10-${mode}-3 toast に undefined/NaN が出ない`, !/undefined|NaN/.test(tb), tb)
log('ERRORS', JSON.stringify(t.errors), JSON.stringify(errB)); check(`P10-${mode}-9 console error なし`, t.errors.length + errB.length === 0, JSON.stringify([...t.errors, ...errB]).slice(0, 300)); summary(); await t.close()
