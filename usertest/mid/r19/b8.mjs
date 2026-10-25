// b8: 「キャンセル不可で発注に戻す」— 承認後まだ外していない行（発注済のまま残す）と外した後、Ctrl+Z / Ctrl+Y、戻した後に o
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); const fl = Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v !== undefined && v !== false)); return `${rid}:${r.status}:ord=${!!r.ordered}:${JSON.stringify(fl)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}${i.pmRuled ? ':ruled' : ''}`).join(',')}` }
const cands = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).map((r) => r.id)
const [A, B] = cands
await t.press('8')
for (const id of [A, B]) { const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
for (const id of [A, B]) log('o', id, await t.order(id))
async function raiseH(id, text) { await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill(text); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); return t.publish() }
async function unorder(id) { await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); return t.toast() }
async function restore(id) {
  await t.goto(id); await t.press('Home')
  await t.cmd('キャンセル不可で発注に戻す', 'キャンセル不可'); await page.waitForTimeout(80)
  const pn = await t.panel()
  if (pn?.kind === 'prompt') { const i = pn.options.findIndex((o) => /戻す|残す/.test(o)); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(100) }
  return { title: pn?.title, options: pn?.options, toast: await t.toast() }
}
const vis = async (role, v, id) => { await t.role(role); await t.press(String(v)); return (await t.viewRows()).includes(id) }
// ---- A: 承認 → 外す前に取引先が断る → 発注済のまま残す
log('h A →', await raiseH(A, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y A →', (await t.yes(A, '承認')).toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
p = await t.proj(); log('A approved', st(p, A))
const r1 = await restore(A); p = await t.proj(); log('restore A (not removed) →', JSON.stringify(r1)); log('A after', st(p, A))
const ra = p.rows.find((r) => r.id === A)
check('B8-1 外す前でも「発注済のまま残す」で依頼を閉じ、発注済のまま（承認は使い切り）', ra.ordered && !ra.flags.orderCancelApproved && p.issues.some((i) => i.rowId === A && i.kind === '発注後変更依頼' && i.status === 'confirmed'), st(p, A))
log('A in purch 4', await vis('purchasing', 4, A), 'PM 7', await vis('pm', 7, A), 'design 4', await vis('design', 4, A))
await t.role('purchasing'); log('o on A after keep →', await unorder(A)); p = await t.proj(); log(st(p, A))
check('B8-2 残した後は o で外せない（承認は使い切り）', p.rows.find((r) => r.id === A).ordered, st(p, A))
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
await t.press('Control+z'); await page.waitForTimeout(100); const z1 = await t.toast(); p = await t.proj(); log('Ctrl+Z →', z1, st(p, A))
check('B8-3 Ctrl+Z で「残す」を戻すと、承認済・外す前に戻る', !!p.rows.find((r) => r.id === A).flags.orderCancelApproved && p.issues.some((i) => i.rowId === A && i.kind === '発注後変更依頼' && i.status === 'inProgress'), z1)
log('o on A after undo →', await unorder(A)); p = await t.proj(); log(st(p, A))
check('B8-4 戻した後は o で外せる', !p.rows.find((r) => r.id === A).ordered, st(p, A))
// ---- B: 承認 → 外す → 戻す → Ctrl+Z → Ctrl+Y
log('h B →', await raiseH(B, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y B →', (await t.yes(B, '承認')).toast)
log('unorder B →', await unorder(B))
const r2 = await restore(B); p = await t.proj(); log('restore B →', r2.toast, st(p, B))
await t.press('Control+z'); await page.waitForTimeout(100); const z2 = await t.toast(); p = await t.proj(); log('Ctrl+Z →', z2, st(p, B))
const rb = p.rows.find((r) => r.id === B)
check('B8-5 外した後に戻したのを Ctrl+Z → 外した状態（代替品検討・置き換え待ち）', !rb.ordered && rb.flags.countermeasure === '代替品検討', st(p, B))
log('B ball', await t.cellText(B, 'ball'), 'design 4', await vis('design', 4, B))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
await t.press('Control+y'); await page.waitForTimeout(100); const y2 = await t.toast(); p = await t.proj(); log('Ctrl+Y →', y2, st(p, B))
check('B8-6 Ctrl+Y でもう一度「発注済に戻す」', p.rows.find((r) => r.id === B).ordered, y2)
// 設計の Ctrl+Z（他人の操作は戻さない）
await t.role('design'); await t.press('Control+z'); await page.waitForTimeout(100); p = await t.proj(); log('design Ctrl+Z →', await t.toast(), st(p, B))
summary(); await t.close()
