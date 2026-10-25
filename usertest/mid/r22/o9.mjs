// o9 (n4 の差分超過の確認を 'b'（次点へ）の決定パネル選択で): 差分超過の決定パネルを開く → 別タブが正式単価を打ち直す → b → 断る
// (元の n4: 2 タブの PM の決定（M19-04 の修正の確認と残り）
//   mode=cs-prompt  : B（PM）が y で理由の欄を開く → A（設計）が Rev.b（Rev.a をまとめる）→ B が Enter → 断る
//   mode=diff-open  : B が差分超過の決定パネルを開く → A（購買）が正式単価を打ち直す → B が y → 断る
//   mode=diff-prompt: B が y で理由の欄を開く（差分超過・受入）→ A が正式単価を打ち直す → B が Enter → 断る
//   mode=diff-back  : B が差分超過のパネルを開く → A が単価を変え、また元に戻す → B が y → 同じ単価なので決められる
//   mode=diff-within: B が差分超過のパネルを開く → A が正式単価を許容内に直す（差分超過が消える）→ B が y → 断る（要決定が変わった）
//   mode=cs-prompt panel: B が Enter で決定パネル → y で理由の欄（パネルから）
//   mode=diff-direct: B が差分超過の行で y（決定パネルを開かず）→ 理由の欄 → A が正式単価を打ち直す → Enter
//   mode=rm-prompt  : B が Rev.a（A・B の必要数）の A で y（理由の欄）→ A タブが B を取消して Rev.b → B が Enter → 断る or A だけ承認（B は含まない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'cs-prompt'
const t = await launch(); const { page, context } = t; const h = helpers(t)
let p
const p2 = await context.newPage()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function openB(role) { await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-' + role).click(); await p2.locator('.gridwrap').focus() }
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
const panB = () => S2('return st.panel ? { kind: st.panel.kind, title: st.panel.title ?? st.panel.label ?? null, options: (st.panel.options ?? []).map((o) => typeof o === "string" ? o : o.label) } : null')
const toastB = () => S2('return st.toast?.text ?? ""')
async function fillPromptB(text) { if (await S2('return st.panel && st.panel.kind === "prompt" ? 1 : 0')) { await p2.getByTestId('prompt-text').fill(text); try { if (await p2.getByTestId('extra-承認者').count()) { await p2.getByTestId('extra-承認者').fill('部長 田中'); await p2.getByTestId('extra-決裁書No').fill('K-77') } } catch {} ; await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(200) } }
const subs = (p) => JSON.stringify(p.submissions.filter((s) => s.changeSet).map((s) => [s.rev, s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : s.changeSet.supersededBy != null ? 'merged→' + s.changeSet.supersededBy : 'pend', s.rowIds.join(','), s.changeSet.merged ?? null]))
await t.open('design')
if (mode === 'cs-prompt' || mode === 'rm-prompt') {
  log('publish drafts →', await t.publish('1'))
  await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
  await t.role('design'); log('bulk →', await t.bulk()); p = await t.proj()
  const sel = p.rows.filter((r) => !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
  const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, qB = sel[1].qtyNeeded, nB = sel[1].name
  await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('B qty →', await t.setCellKey(B, 'qtyNeeded', String(qB + 1))); log('publish Rev.a →', await t.publish('1'))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(A)
  if (process.argv[3] === 'panel') { await p2.keyboard.press('Enter'); await p2.waitForTimeout(120); await p2.keyboard.press('y') } else await p2.keyboard.press('y')
  await p2.waitForTimeout(120)
  log('B prompt', JSON.stringify(await panB()))
  if (mode === 'cs-prompt') { log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')); log('publish Rev.b →', await t.publish('3')) }
  else {
    await t.goto(B); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) }
    log('publish Rev.b (B 取消) →', await t.publish('1'))
  }
  await page.waitForTimeout(800); log('B panel after', JSON.stringify(await panB()))
  await fillPromptB('Rev.a を承認'); const tb = await toastB(); log('B Enter →', tb)
  await page.waitForTimeout(800); p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
  log('after', subs(p), 'A', rA.qtyNeeded, rA.name, rA.status, 'B', rB.qtyNeeded, rB.name, rB.status)
  if (mode === 'cs-prompt') check('N4-1 理由の欄を開いたあとに Rev.b が出たら、確定で Rev.b（B の部品名）まで承認されない', rB.name === nB && rA.name !== 'NAME-A2', `A name=${rA.name} B name=${rB.name} toast=${tb}`)
  else check('N4-1 理由の欄を開いたあとに B の取消（Rev.b）が出たら、確定で B の取消まで承認されない', rB.status !== 'cancelled', `B status=${rB.status} qty=${rB.qtyNeeded} toast=${tb}`)
} else {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
  const X = fr[0].id; const sidA = fr[0].adoptedSupplierId; const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === sidA && !q.stale)
  const col = 'q.formalPrice@' + 'A'
  await t.press('8'); const P1 = q0.unitPrice * 2 + 20000, P2 = q0.unitPrice * 5 + 50000
  log('formal price →', P1, await t.setCellKey(X, col, String(P1))); await t.press('Escape')
  p = await t.proj(); log('X', h.show(p, X), 'case', await h.caseOf(X))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(X)
  if (mode === 'diff-prompt') { await p2.keyboard.press('Enter'); await p2.waitForTimeout(100); await p2.keyboard.press('y'); await p2.waitForTimeout(120) } else if (mode === 'diff-direct') { await p2.keyboard.press('y') } else await p2.keyboard.press('Enter')
  await p2.waitForTimeout(120)
  log('B panel', JSON.stringify(await panB()))
  const P = mode === 'diff-within' ? q0.unitPrice : P2
  log('A formal price →', P, await t.setCellKey(X, col, String(P))); await t.press('Escape')
  if (mode === 'diff-back') { log('A formal price back →', P1, await t.setCellKey(X, col, String(P1))); await t.press('Escape') }
  await page.waitForTimeout(800); p = await t.proj(); log('X after A', h.show(p, X), 'case', await h.caseOf(X), 'status', p.rows.find((r) => r.id === X).status)
  if (mode === 'diff-prompt' || mode === 'diff-direct') { await fillPromptB('差額を確認して受入') } else { await p2.keyboard.press(process.argv[3] ?? 'y'); await p2.waitForTimeout(150); await fillPromptB('差額を確認して処理') }
  const tb = await toastB(); log('B →', tb)
  await page.waitForTimeout(800); p = await t.proj(); const rX = p.rows.find((r) => r.id === X); const qf = p.quotes.find((q) => q.rowId === X && q.supplierId === rX.adoptedSupplierId && !q.stale)
  log('after', h.show(p, X), 'status', rX.status, 'formalPrice', qf.formalPrice, 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === X).map((d) => [d.kind, d.reason])))
  if (mode === 'diff-back') check('N4-1 見たときと同じ正式単価（変えて戻した）なら決められる（受入）', rX.status === 'formalQuoted' && qf.formalPrice === P1, `status=${rX.status} price=${qf.formalPrice} toast=${tb}`)
  else if (mode === 'diff-within') check('N4-1 差分超過が消えた（許容内に直した）あとの y は断る（要決定が変わった）。受入の決定の記録が残らない', !p.decisions.some((d) => d.rowId === X && d.kind === '受入'), `status=${rX.status} price=${qf.formalPrice} toast=${tb}`)
  else check(`O9-1 PM が見た正式単価 ${P1} と違う ${P2} のとき、パネルの ${process.argv[3] ?? 'y'} は決めずに知らせる。受入／次点／再交渉の決定が残らない`, !p.decisions.some((d) => d.rowId === X && ['受入', '次点商社へ', '再交渉', '設計へ代替依頼', '数量見直し依頼'].includes(d.kind)) && rX.flags.formalDiff, `status=${rX.status} price=${qf.formalPrice} toast=${tb}`)
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
