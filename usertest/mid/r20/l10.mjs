// l10: 2 タブ
//   mode=surplus: タブ A（購買）が発注数のセルに 100 を打ちかけ → タブ B（PM）が最小ロットの余剰を却下 → A が Enter で確定
//   mode=cs     : 承認 ON。タブ B（PM）が R の変更セット Rev.a の決定パネルを開いたまま → タブ A（設計）が同じ行に Rev.b を公開 → B が y
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'surplus'
const t = await launch(); const { page, context } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status]))
await t.open('design')
let p
const p2 = await context.newPage()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function openB(role) { await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-' + role).click(); await p2.locator('.gridwrap').focus() }
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
if (mode === 'surplus') {
  log('bulk →', await t.bulk()); p = await t.proj()
  const X = p.rows.find((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 4 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0) > 2000).id
  log('X', h.show(p, X))
  await t.role('purchasing'); await t.press('6'); await t.setCellKey(X, 'q.moq@S1', '100'); await t.press('Escape')
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  log('publish →', await t.publish()); p = await t.proj(); log('case', await h.caseOf(X))
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80)
  // A: 発注数のセルに 100 を打ちかける
  await t.press('3'); await t.showCol('orderQty'); await t.goto(X); await t.colKey('orderQty'); await page.keyboard.press('Enter'); await page.waitForTimeout(40); await page.keyboard.press('Control+a'); await page.keyboard.type('100')
  log('A mode', await t.mode())
  // B: PM が却下
  await goto2(X); await p2.keyboard.press('Shift+Y'); await p2.waitForTimeout(100); if (await S2('return st.panel ? 1 : 0')) { await p2.getByTestId('prompt-text').fill('余剰は受け入れない'); await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(150) }
  log('B →', await S2('return st.toast?.text ?? ""'), 'B flags', JSON.stringify(await S2(`return p.rows.find((r) => r.id === '${X}').flags`)))
  await page.waitForTimeout(800)
  log('A mode after B', await t.mode(), 'A sees surplusRejected', await t.S(`return p.rows.find((r) => r.id === '${X}').flags.surplusRejected ?? null`))
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); const ta = await t.toast(); if ((await t.mode()) === 'edit') await page.keyboard.press('Escape')
  await page.waitForTimeout(500); p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
  log('A commit →', ta, '|', h.show(p, X), iss(p, X))
  check('L10S-1 別のタブで PM が余剰を却下した直後に、開いていた発注数 100 を確定しても入らない（却下が効く・知らせる）', rX.orderQty !== 100, `oq=${rX.orderQty} toast=${ta}`)
  check('L10S-2 最小ロットの指摘が対応済にならず購買に残る', p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && i.status === 'open'), iss(p, X))
} else {
  log('publish drafts →', await t.publish('1'))
  await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
  await t.role('design'); log('bulk →', await t.bulk()); p = await t.proj()
  const sel = p.rows.filter((r) => !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
  const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, nB = sel[1].name
  await t.press('1'); log('A qty →', await t.setCellKey(A, 'qtyNeeded', String(qA + 1))); log('publish Rev.a →', await t.publish('1'))
  // B: PM が A の決定パネルを開く
  await openB('pm'); await p2.keyboard.press('7'); await p2.waitForTimeout(80); await goto2(A); await p2.keyboard.press('Enter'); await p2.waitForTimeout(120)
  const panB = await S2('return st.panel ? { title: st.panel.title, options: (st.panel.options ?? []).map((o) => typeof o === "string" ? o : o.label) } : null'); log('B panel', JSON.stringify(panB))
  // A: 設計が同じ行と B の行を変えて Rev.b を公開
  log('A name →', await t.setCellKey(A, 'name', 'NAME-A2')); log('B name →', await t.setCellKey(B, 'name', 'NAME-B2')); log('publish Rev.b →', await t.publish('3'))
  await page.waitForTimeout(800)
  const panB2 = await S2('return st.panel ? { title: st.panel.title, options: (st.panel.options ?? []).map((o) => typeof o === "string" ? o : o.label) } : null'); log('B panel after A publish', JSON.stringify(panB2))
  // B: y（開いていたパネルで承認）
  await p2.keyboard.press('y'); await p2.waitForTimeout(150); if (await S2('return st.panel && st.panel.kind === "prompt" ? 1 : 0')) { await p2.getByTestId('prompt-text').fill('Rev.a を承認'); try { await p2.getByTestId('extra-承認者').fill('部長 田中'); await p2.getByTestId('extra-決裁書No').fill('K-77') } catch {} ; await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(200) }
  log('B y →', await S2('return st.toast?.text ?? ""'))
  await page.waitForTimeout(800); p = await t.proj(); const rB = p.rows.find((r) => r.id === B), rA = p.rows.find((r) => r.id === A)
  const subs = JSON.stringify(p.submissions.filter((s) => s.changeSet).map((s) => [s.rev, s.changeSet.reason, s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : s.changeSet.supersededBy != null ? 'merged→' + s.changeSet.supersededBy : 'pend', s.rowIds.join(',')]))
  log('after', subs, 'A', rA.qtyNeeded, rA.name, 'B', rB.name, 'B pending', rB.flags.pmPending ?? false)
  check('L10C-1 PM が Rev.a（A の必要数）を見て開いたパネルの y で、見ていない Rev.b の B の部品名まで承認されない（知らせて決め直させる）', rB.name === nB || /Rev\.?\s*\d|変わ|開き直/.test(await S2('return st.toast?.text ?? ""')) && rB.name === nB, `B name=${rB.name} subs=${subs}`)
}
const e2 = await S2('return 0').catch(() => 0)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l10-' + mode)
summary(); await t.close()
