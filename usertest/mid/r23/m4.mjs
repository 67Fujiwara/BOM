// m4: 2 タブで PM の決定（M18-04 の修正「決定パネルを開いたあとに Rev・種別が変わったら決めずに知らせる」の先）
//   mode=cs       : 承認 ON。B（PM）が A の Rev.a の決定パネルを開く → A タブ（設計）が A・B に Rev.b → B が y（断られる）→ Shift+Y も → 開き直すと Rev.b（Rev.a をまとめた）→ y
//   mode=prompt   : 承認 ON。B（PM）が A でパネルを開かずに y（理由の欄が開く）→ A タブが Rev.b を公開 → B が理由を入れて Enter
//   mode=unrelated: 承認 ON。B が A のパネルを開く → A タブが別の行 C に Rev.b → B が y（A の Rev.a は変わっていないので決められる）
//   mode=exc      : B が例外選定（2 位の商社）の決定パネルを開く → A タブの選定者が 3 位の商社に選び直す（また例外選定）→ B が y
//   mode=diff     : B が差分超過（正式単価）の決定パネルを開く → A タブの購買が正式単価を打ち直す（さらに高い）→ B が y
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'cs'
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
if (['cs', 'prompt', 'unrelated'].includes(mode)) {
  log('publish drafts →', await t.publish('1'))
  await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
  await t.role('design'); log('bulk →', await t.bulk()); p = await t.proj()
  const sel = p.rows.filter((r) => !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
  const A = sel[0].id, B = sel[1].id, C = sel[2].id, qA = sel[0].qtyNeeded, nB = sel[1].name, nC = sel[2].name
  await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('publish Rev.a →', await t.publish('1'))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(A)
  if (mode === 'prompt') { await p2.keyboard.press('y'); await p2.waitForTimeout(120) } else { await p2.keyboard.press('Enter'); await p2.waitForTimeout(120) }
  log('B panel', JSON.stringify(await panB()))
  if (mode === 'unrelated') { log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')) } else { log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')) }
  log('publish Rev.b →', await t.publish('3')); await page.waitForTimeout(800)
  log('B panel after A publish', JSON.stringify(await panB()))
  if (mode === 'prompt') await fillPromptB('Rev.a の必要数を承認')
  else { await p2.keyboard.press('y'); await p2.waitForTimeout(150); await fillPromptB('Rev.a を承認') }
  const tb = await toastB(); log('B y →', tb)
  await page.waitForTimeout(800); p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B), rC = p.rows.find((r) => r.id === C)
  log('after', subs(p), 'A', rA.qtyNeeded, rA.name, 'B', rB.name, 'C', rC.name, 'A pending', rA.flags.pmPending ?? false)
  if (mode === 'unrelated') {
    check('M4U-1 別の行（C）の変更セットの公開では、開いていた A の Rev.a の y は断られずに承認される（C は承認待ちのまま）', rA.qtyNeeded === qA + 1 && !rA.flags.pmPending && rC.name === nC && rC.flags.pmPending, `A ${rA.qtyNeeded} pm=${rA.flags.pmPending} C ${rC.name} toast=${tb}`)
  } else {
    check(`M4${mode === 'cs' ? 'C' : 'P'}-1 PM が Rev.a（A の必要数）を見て始めた決定の確定で、見ていない Rev.b の B の部品名まで承認されない（決めずに知らせる）`, rB.name === nB && rA.name !== 'NAME-A2', `B name=${rB.name} A name=${rA.name} toast=${tb}`)
    if (mode === 'cs') {
      await p2.keyboard.press('Escape'); await p2.keyboard.press('Escape')
      await goto2(A); await p2.keyboard.press('Enter'); await p2.waitForTimeout(120); const pn = await panB(); log('B reopen', JSON.stringify(pn))
      check('M4C-2 開き直した決定パネルは Rev.b（Rev.a の変更をまとめた）・2 行', /Rev\.\d+（Rev\.\d+ の変更をまとめた）/.test(pn?.title ?? '') && pn?.options?.some((o) => /2 行/.test(o)), JSON.stringify(pn))
      await p2.keyboard.press('y'); await p2.waitForTimeout(150); await fillPromptB('Rev.b を確認して承認'); log('B y (reopened) →', await toastB())
      await page.waitForTimeout(800); p = await t.proj(); const a2 = p.rows.find((r) => r.id === A), b2 = p.rows.find((r) => r.id === B)
      check('M4C-3 開き直したパネルの y で A の必要数・部品名、B の部品名が公開値に', a2.qtyNeeded === qA + 1 && a2.name === 'NAME-A2' && b2.name === 'NAME-B2', `A ${a2.qtyNeeded} ${a2.name} B ${b2.name}`)
    }
  }
} else if (mode === 'exc') {
  // 見積済の行で、2 位・3 位がどちらも例外選定（PM 承認待ち）になる行を探す
  const sc = await page.evaluate(async () => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積').map((r) => [r.id, m.scoreRow(p, r, s.ws.suppliers).map((x) => [x.supplierId, x.total])]).filter(([, a]) => a.length === 3 && a[0][1] - a[1][1] > 8 && a[0][1] - a[2][1] > 8) })
  log('cands', JSON.stringify(sc.slice(0, 5)))
  let X = null, s2, s3
  for (const [id, ranks] of sc) {
    const r2 = await h.adoptPick(id, 2, '6', '2 位で'); p = await t.proj()
    if (p.rows.find((r) => r.id === id).flags.pmPending) { X = id; s2 = ranks[1][0]; s3 = ranks[2][0]; log('X', id, r2.toast); break }
  }
  if (!X) { log('NO X'); process.exit(0) }
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(X); await p2.keyboard.press('Enter'); await p2.waitForTimeout(120)
  log('B panel', JSON.stringify(await panB()), 'sees supplier', s2)
  const r3 = await h.adoptPick(X, 3, '6', '3 位に変える'); await page.waitForTimeout(800); p = await t.proj(); log('A re-adopt 3rd →', r3.toast, h.show(p, X))
  log('B panel after', JSON.stringify(await panB()))
  await p2.keyboard.press('y'); await p2.waitForTimeout(150); await fillPromptB('2 位の理由を確認、承認'); const tb = await toastB(); log('B y →', tb)
  await page.waitForTimeout(800); p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
  log('after', h.show(p, X))
  check(`M4E-1 PM が ${s2} の例外選定を見て開いたパネルの y で、開いたあとに選び直した ${s3} が承認されない（決めずに知らせる）`, !(rX.adoptedSupplierId === s3 && !rX.flags.pmPending), `${h.show(p, X)} toast=${tb}`)
} else if (mode === 'diff') {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
  const X = fr[0].id; const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === fr[0].adoptedSupplierId && !q.stale)
  await t.press('8'); log('formal price x2 →', await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * 2 + 20000))); await t.press('Escape')
  p = await t.proj(); log('X', h.show(p, X), 'case', await h.caseOf(X))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(X); await p2.keyboard.press('Enter'); await p2.waitForTimeout(120)
  log('B panel', JSON.stringify(await panB()))
  log('formal price x5 →', await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * 5 + 50000))); await t.press('Escape'); await page.waitForTimeout(800)
  p = await t.proj(); log('X after A', h.show(p, X), 'case', await h.caseOf(X))
  await p2.keyboard.press('y'); await p2.waitForTimeout(150); await fillPromptB('差額を確認して受入'); const tb = await toastB(); log('B y →', tb)
  await page.waitForTimeout(800); p = await t.proj(); const rX = p.rows.find((r) => r.id === X); const qf = p.quotes.find((q) => q.rowId === X && q.supplierId === rX.adoptedSupplierId && !q.stale)
  log('after', h.show(p, X), 'status', rX.status, 'formalPrice', qf.formalPrice, 'decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === X).map((d) => [d.kind, d.reason, d.payload ?? null])))
  check(`M4D-1 PM が正式単価 ${q0.unitPrice * 2 + 20000} の差分超過を見て開いたパネルの y で、開いたあとに打ち直した ${q0.unitPrice * 5 + 50000} が受け入れられない（決めずに知らせる）`, !(rX.status === 'formalQuoted' && qf.formalPrice === q0.unitPrice * 5 + 50000 && !rX.flags.formalDiff), `status=${rX.status} price=${qf.formalPrice} toast=${tb}`)
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
