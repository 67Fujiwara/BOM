// q6 (p10 の続き): 2 タブ。y／Shift+Y の直接入力で理由の欄を開いたあと、別タブで 必要数・発注数・正式単価・採用商社 が変わる（M21-06 の周辺）
//   mode=diff-qty  : 差分超過の行。B(PM) が y（理由の欄）→ A(設計) が必要数を変えて公開 → B が Enter。受入されない（見ていない数量）
//   mode=diff-order: 差分超過の行。B が y（理由の欄）→ A(購買) が発注数を変える → B が Enter。受入されない
//   mode=exc-stop-y: 例外選定の行。B が y（理由の欄）→ A が採用商社を取引停止にする（JSON）→ B が Enter。承認されない／例外なし
//   mode=exc-stop-Y: 例外選定の行。B が Shift+Y（理由の欄）→ 同上 → B が Enter。却下が選ばれていない商社に及ばない／例外なし
//   mode=exc-qty-y : 例外選定の行。B が y（理由の欄）→ A が必要数を変えて公開 → B が Enter
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { importWs, stuck } from './plib.mjs'
const mode = process.argv[2] ?? 'ng-enter'
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
await t.open('design'); await t.press('2'); if (!mode.startsWith('ltb')) log('bulk →', (await t.bulk()).slice(0, 40))
if (mode.startsWith('ng')) {
  await t.setTime('2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300); p = await t.proj()
  X = p.rows.find((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.pmPending && r.qtyNeeded >= 2)?.id
} else if (mode.startsWith('diff')) {
  await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-40)); p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 3 && !r.needDateFixed)
  X = fr[0].id; const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === fr[0].adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * 2 + 20000)); await t.press('Escape')
} else if (mode.startsWith('ltb')) {
  p = await t.proj(); const r = p.rows.find((x) => x.status === 'quoted' && !x.adoptedSupplierId && x.procurement === '相見積'); X = r?.id
  if (X) { await t.role('purchasing'); await t.press('5'); await t.goto(X); await t.cmd('先行発注を申請'); await page.waitForTimeout(100); if ((await t.panel())?.kind === 'prompt') { await t.promptFill('長納期'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150) } }
}
if (!X) { check(`Q6-${mode}-0 前提`, false, 'no row'); summary(); await t.close(); process.exit(0) }
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); log('X', X, h.show(p, X).slice(0, 220), 'case', JSON.stringify(await h.caseOf(X)))
const dec0 = p.decisions.filter((d) => d.rowId === X).length
await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(100); await goto2(X)
const key = mode.endsWith('-Y') ? 'Shift+Y' : mode.endsWith('-y') ? 'y' : mode.endsWith('-b') ? 'b' : null
if (mode.endsWith('-enter') || mode.endsWith('-enterY') || mode.endsWith('-enterb')) { await p2.keyboard.press('Enter'); await p2.waitForTimeout(200); log('B panel', JSON.stringify(await panB())) }
// 直接入力 or パネルのあとのキー
const k2 = mode.endsWith('enterY') ? 'Shift+Y' : mode.endsWith('enterb') ? 'b' : mode.endsWith('-enter') ? (mode.startsWith('ng') ? 'Shift+Y' : mode.startsWith('diff') ? 'y' : 'y') : key
// A の変更：設計が必要数を大きく変え、購買が概算を取り直す
const doA = async () => { await t.role('design'); await t.press('1'); await t.setCellKey(X, 'qtyNeeded', String(r0.qtyNeeded * 3 + 5)); log('A publish →', (await t.publish('1')).slice(-40)); await t.role('purchasing'); const rq = await h.requestTo(null); log('A rough →', rq.msg.slice(0, 60), JSON.stringify(rq.f.map((f) => f.ids.includes(X)))) }
if (mode.endsWith('-enter') || mode.endsWith('-enterY') || mode.endsWith('-enterb')) {
  await doA(); await page.waitForTimeout(900)
  p = await t.proj(); log('state before B key', h.show(p, X).slice(0, 240), 'case', JSON.stringify(await h.caseOf(X)))
  await p2.keyboard.press(k2); await p2.waitForTimeout(200); log('B after key', JSON.stringify(await panB()), await toastB())
} else {
  await p2.keyboard.press(k2); await p2.waitForTimeout(200); log('B prompt', JSON.stringify(await panB())); check(`Q6-${mode}-0 B に理由の欄が開く`, (await panB())?.kind === 'prompt', JSON.stringify(await panB()))
  await doA(); await page.waitForTimeout(900); p = await t.proj(); log('state before B Enter', h.show(p, X).slice(0, 240), 'case', JSON.stringify(await h.caseOf(X)))
}
await fillPromptB('確定する'); const tb = await toastB(); log('B Enter →', tb); await page.waitForTimeout(900)
p = await t.proj(); const rA = p.rows.find((r) => r.id === X); const decs = p.decisions.filter((d) => d.rowId === X).slice(dec0).map((d) => [d.kind, d.reason])
log('after', h.show(p, X).slice(0, 280), 'new decisions', JSON.stringify(decs), 'B panel', JSON.stringify(await panB()), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
check(`Q6-${mode}-1 別タブで概算が取り直されたあと、古い決定パネルから決定が記録されない（見ていない状態への受入・次点・承認）`, decs.length === 0, `decisions=${JSON.stringify(decs)} toast=${tb}`)
check(`Q6-${mode}-2 取り直し中の行が、採用なしで受入された・選定済になった状態にならない`, !(rA.status === 'selected' && !rA.adoptedSupplierId) && !(rA.flags.leadNG && !rA.adoptedSupplierId), h.show(p, X).slice(0, 200))
const sk = await stuck(t); check(`Q6-${mode}-3 固まる行がない`, sk.length === 0, sk.slice(0, 3))
check(`Q6-${mode}-4 toast に undefined/NaN が出ない`, !/undefined|NaN/.test(tb), tb)
log('ERRORS', JSON.stringify(t.errors), JSON.stringify(errB)); check(`Q6-${mode}-9 console error なし`, t.errors.length + errB.length === 0, JSON.stringify([...t.errors, ...errB]).slice(0, 300)); summary(); await t.close()
