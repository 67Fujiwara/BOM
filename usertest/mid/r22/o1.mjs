// o1: 2 タブ。y / Shift+Y の直接入力（M20-01 の修正の確認）と、決定パネルの周辺
//   mode=gone   : B（PM タブ）が Rev.a の A で y（理由の欄）→ A タブ（PM）が同じ A を承認 → B が Enter。二重に決まらない
//   mode=rej    : B が A で Shift+Y（理由の欄・必須）→ 設計タブが A・B の部品名を変えて Rev.b → B が理由を入れて Enter。却下されない（見ていない Rev.b）
//   mode=moq    : 最小ロット余剰（閾値超）。B が y（理由の欄）→ 購買タブが発注数を 100 → 500 に変える → B が Enter。承認されない or 見た内容で承認
//   mode=revert : B が A で Shift+Y（理由の欄）→ 設計タブが A の必要数をさらに +1 して公開（Rev.b が Rev.a をまとめる）→ 設計がそれを元に戻して公開（Rev.c）→ B が Enter
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
const mode = process.argv[2] ?? 'gone'
const t = await launch(); const { page, context } = t; const h = helpers(t); const c = csHelpers(t, h)
const p2 = await context.newPage()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function openB(role) { await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-' + role).click(); await p2.locator('.gridwrap').focus() }
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
const panB = () => S2('return st.panel ? { kind: st.panel.kind, title: st.panel.title ?? null } : null')
const toastB = () => S2('return st.toast?.text ?? ""')
async function fillPromptB(text) { if (await S2('return st.panel && st.panel.kind === "prompt" ? 1 : 0')) { await p2.getByTestId('prompt-text').fill(text); try { if (await p2.getByTestId('extra-承認者').count()) { await p2.getByTestId('extra-承認者').fill('部長 田中'); await p2.getByTestId('extra-決裁書No').fill('K-77') } } catch {} ; await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(250) } }
let p
if (mode === 'exc') {
  await t.open('design'); log('bulk →', await t.bulk()); await t.press('1')
  let X = null
  for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021', 'R022', 'R023']) { await h.adoptPick(id, 3, '6', '評価用'); if ((await t.row(id)).flags.pmPending) { X = id; break } }
  p = await t.proj(); const sid0 = p.rows.find((r) => r.id === X).adoptedSupplierId; log('exception row', X, h.show(p, X).slice(0, 200))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(X); await p2.keyboard.press('y'); await p2.waitForTimeout(150)
  log('B prompt', JSON.stringify(await panB()))
  // 設計が別の商社（2 位）に選び直す
  const r2 = await h.adoptPick(X, 2, '6', '選び直し'); p = await t.proj(); const rX0 = p.rows.find((r) => r.id === X)
  log('design re-pick 2 →', r2.toast, '|', h.show(p, X).slice(0, 200))
  await page.waitForTimeout(600)
  await fillPromptB('例外を承認'); const tb = await toastB(); log('B Enter →', tb); await page.waitForTimeout(700)
  p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
  log('after', h.show(p, X).slice(0, 220), 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === X).map((d) => [d.kind, d.reason])))
  const changed = rX0.adoptedSupplierId !== sid0
  check('O1-exc-1 PM が見た例外選定の商社（' + sid0 + '）と違う商社に選び直された（' + rX0.adoptedSupplierId + '）あとの y は、確認なしに承認しない', !changed || !p.decisions.some((d) => d.rowId === X && d.kind === '承認'), `before=${sid0} now=${rX0.adoptedSupplierId} toast=${tb} decisions=${JSON.stringify(p.decisions.filter((d) => d.rowId === X).map((d) => d.kind))}`)
} else if (mode === 'moq') {
  await t.open('design'); log('bulk →', await t.bulk()); p = await t.proj()
  const price = (r) => p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0
  const cand = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 5 && r.qtyNeeded <= 40 && (100 - r.qtyNeeded - 1) * price(r) > 25000)
  const X = cand[0].id; const need = cand[0].qtyNeeded
  await t.role('purchasing'); await t.press('6')
  log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  log('publish →', (await t.publish()).slice(0, 80))
  await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
  p = await t.proj(); log('X', h.show(p, X), 'case', await h.caseOf(X))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(X); await p2.keyboard.press('y'); await p2.waitForTimeout(150)
  log('B prompt', JSON.stringify(await panB()))
  log('purchasing orderQty 500 →', await t.setCellKey(X, 'orderQty', '500')); await t.press('Escape'); await page.waitForTimeout(600)
  p = await t.proj(); log('X now', h.show(p, X).slice(0, 200), 'case', await h.caseOf(X))
  await fillPromptB('余剰を承認'); const tb = await toastB(); log('B Enter →', tb); await page.waitForTimeout(700)
  p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
  log('after', h.show(p, X).slice(0, 220), 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === X).map((d) => [d.kind, d.reason])))
  const approved500 = p.decisions.some((d) => d.rowId === X && d.kind === '承認') && rX.orderQty === 500
  check('O1-moq-1 PM が見た発注数（100）と違う 500 を、確認なしに承認しない', !approved500, `orderQty=${rX.orderQty} toast=${tb}`)
} else {
  const sel = await c.setup(); p = await t.proj()
  const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, qB = sel[1].qtyNeeded, nA = sel[0].name, nB = sel[1].name
  await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('B qty →', await t.setCellKey(B, 'qtyNeeded', String(qB + 1))); log('publish Rev.a →', (await t.publish('1')).slice(0, 80))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(A)
  if (mode === 'panel-gone') { await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) } else await p2.keyboard.press(mode === 'gone' ? 'y' : 'Shift+Y'); await p2.waitForTimeout(150)
  log('B prompt', JSON.stringify(await panB()))
  if (mode === 'gone' || mode === 'panel-gone') {
    await t.role('pm'); await t.press('7'); log('A タブ（PM）が A を承認 →', (await t.yes(A, 'Rev.a 承認')).toast)
    p = await t.proj(); log('after A approve', c.subs(p))
  } else if (mode === 'rej') {
    await t.role('design'); await t.press('1'); log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')); log('publish Rev.b →', (await t.publish('3')).slice(0, 80))
  } else if (mode === 'revert') {
    await t.role('design'); await t.press('1'); log('A qty +1 →', await t.setCellKey(A, 'qtyNeeded', String(qA + 2))); log('publish Rev.b →', (await t.publish('1')).slice(0, 80))
    log('A qty back →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('publish Rev.c →', (await t.publish('1')).slice(0, 80))
  }
  await page.waitForTimeout(800); p = await t.proj(); log('state before B Enter', c.subs(p))
  if (mode === 'panel-gone') { await p2.keyboard.press('y'); await p2.waitForTimeout(250) }
await fillPromptB(mode === 'gone' || mode === 'panel-gone' ? '二重承認' : '却下する'); const tb = await toastB(); log('B Enter →', tb); await page.waitForTimeout(800)
  p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  const decs = p.decisions.filter((d) => d.rowId === A).map((d) => [d.kind, d.reason])
  log('after', c.subs(p), 'A', rA.qtyNeeded, rA.name, rA.status, 'B', rB.qtyNeeded, rB.name, 'decisions A', JSON.stringify(decs))
  if (mode === 'gone' || mode === 'panel-gone') check(`O1-${mode}-1 すでに承認された A への 2 回目の y は決定を重ねない（決定の記録は 1 件）`, decs.length === 1, `decisions=${JSON.stringify(decs)} toast=${tb}`)
  else if (mode === 'rej') check('O1-rej-1 理由の欄を開いたあとに Rev.b が出たら、確定でも Rev.b を却下しない（見ていない変更）', !decs.some((d) => d[0] === '却下') && !p.submissions.some((s) => s.rev === 4 && s.changeSet?.rejected), `decisions=${JSON.stringify(decs)} subs=${c.subs(p)} toast=${tb}`)
  else check('O1-revert-1 Rev が差し替わった（元に戻っても別の Rev）あとの Shift+Y は見直しを求める。却下が決まらない', !decs.some((d) => d[0] === '却下'), `decisions=${JSON.stringify(decs)} subs=${c.subs(p)} toast=${tb}`)
}
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
