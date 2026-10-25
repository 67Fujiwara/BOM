// n6: 正式依頼の取下げ（複数・1 件ずつ x）
//   mode=multi  : 正式依頼 → 差分超過 → PM が b（次点）→ 正式依頼し直す → また差分超過 → b → 取下げが 2 件並ぶ → x で 1 件ずつ（残りの案内）
//   mode=cancel : 正式依頼中の行を設計が取消 → 公開 → 購買の 9 に取消の行が取下げで出る → x
//   mode=replace: 正式依頼中の行を設計が置換 → 公開 → 元の行の取下げが 9 に出る → x。新行は要再確認
//   mode=undo   : multi の x のあとの Ctrl+Z（戻る）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'multi'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal()); let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending)
const X = fr[0].id; log('X', h.show(p, X))
const wd = async () => (await t.proj()).rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
async function bigFormal(mult) {
  p = await t.proj(); const rX = p.rows.find((r) => r.id === X); const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === rX.adoptedSupplierId && !q.stale)
  await t.role('purchasing'); await t.press('8'); const r = await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * mult + 30000)); await t.press('Escape'); return r
}
async function pmB() {
  await t.role('pm'); await t.press('7'); await t.goto(X); await t.press('Enter'); await page.waitForTimeout(100); const pn = await t.panel()
  await t.press('b'); await page.waitForTimeout(100); const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('次点へ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150) }
  if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
  return { opts: pn?.options, toast: await t.toast() }
}
async function xOnce() { await t.role('purchasing'); await t.press('9'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 220); await t.press('x'); await page.waitForTimeout(120); return { sb, toast: await t.toast(), after: await wd() } }
if (mode === 'multi' || mode === 'undo') {
  const s1 = (await t.proj()).rows.find((r) => r.id === X).adoptedSupplierId
  log('big formal 1 →', await bigFormal(3)); log('case', await h.caseOf(X)); const b1 = await pmB(); log('PM b 1 →', JSON.stringify(b1)); p = await t.proj(); log('X', h.show(p, X))
  check('N6-1 1 回目の次点で取下げが 1 件', (await wd()).split(' / ').filter(Boolean).length === 1, await wd())
  await t.role('purchasing'); log('formal again →', await t.requestFormal()); p = await t.proj(); log('X', h.show(p, X))
  log('big formal 2 →', await bigFormal(4)); log('case', await h.caseOf(X)); const b2 = await pmB(); log('PM b 2 →', JSON.stringify(b2)); p = await t.proj(); log('X', h.show(p, X))
  const list = (await wd()).split(' / ').filter(Boolean)
  check('N6-2 2 回目の次点で取下げが 2 件（商社・依頼No）並ぶ', list.length === 2 && list[0] !== list[1], await wd())
  await t.role('purchasing'); await t.press('9'); log('purchasing 9 has X', (await t.viewRows()).includes(X), 'ball', await h.ballOf(X))
  check('N6-3 購買の 9 に取下げの行が出る', (await t.viewRows()).includes(X), '')
  const x1 = await xOnce(); log('x1', JSON.stringify(x1))
  check('N6-4 x で 1 件ずつ（1 回目：残り 1 件の案内）', x1.after.split(' / ').filter(Boolean).length === 1 && /残り 1 件/.test(x1.toast), JSON.stringify(x1))
  if (mode === 'undo') { await page.keyboard.press('Control+z'); await page.waitForTimeout(100); log('Ctrl+Z →', await t.toast(), '| wd', await wd()); check('N6-4u Ctrl+Z で確認した取下げが戻る（2 件）', (await wd()).split(' / ').filter(Boolean).length === 2, await wd()); await xOnce() }
  const x2 = await xOnce(); log('x2', JSON.stringify(x2))
  check('N6-5 x の 2 回目で取下げが無くなる', x2.after === '', JSON.stringify(x2))
  await t.press('9'); log('purchasing 9 has X after', (await t.viewRows()).includes(X))
  const x3 = await xOnce(); log('x3 (nothing left)', JSON.stringify(x3))
} else {
  await t.role('design'); await t.press('1')
  if (mode === 'cancel') { await t.goto(X); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('取消') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) } }
  else { log('replace →', await t.replace(X, 'CLIPFIX-NEW')); p = await t.proj(); const nid = p.rows.find((r) => r.replaces === X)?.id; log('new', nid); if (nid) log('maker →', await t.setCellKey(nid, 'maker', 'フエニックス')) }
  log('publish →', await t.publish('1')); p = await t.proj(); log('X', h.show(p, X), 'status', p.rows.find((r) => r.id === X).status)
  check('N6-1 元の商社への正式依頼の取下げが記録される', (await wd()).length > 0, await wd())
  await t.role('purchasing'); await t.press('9'); const in9 = (await t.viewRows()).includes(X); log('purchasing 9 has X', in9)
  check('N6-2 取消・置換済の行が購買の 9 に（取下げを伝えるため）出る', in9, '')
  const x1 = await xOnce(); log('x', JSON.stringify(x1))
  check('N6-3 x で取下げを確認でき、9 から消える', x1.after === '' && !(await (async () => { await t.press('9'); return (await t.viewRows()).includes(X) })()), JSON.stringify(x1))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
