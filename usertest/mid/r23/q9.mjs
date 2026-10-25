// q9: 再見積要（必要数 ×3+5）の行を購買が「据え置き」（Ctrl+. →「再見積要: 据え置き」）。状態ごと（選定済+納期NG／正式依頼中／正式見積済+差分超過／例外選定の承認待ち）。
//   据え置きは採用・正式依頼・PM の判断を壊さず、旧見積が有効に戻り、固まる行が出ないこと
//   usage: node q9.mjs ng|formal|diff|exc
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck } from './plib.mjs'
import { inv } from './nlib.mjs'
const mode = process.argv[2] ?? 'ng'; const tag = 'Q9-' + mode
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('2'); if (mode !== 'exc') await t.bulk()
let p = await t.proj(); let X
if (mode === 'ng') { await t.setTime('2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300); p = await t.proj(); X = p.rows.find((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.working)?.id }
else if (mode === 'formal' || mode === 'diff') {
  await t.role('purchasing'); await t.requestFormal(); p = await t.proj()
  const r = p.rows.find((x) => x.status === 'formalRequested' && x.procurement === '相見積' && !x.flags.contested && !x.flags.leadNG && !x.needDateFixed && x.qtyNeeded >= 3); X = r?.id
  if (mode === 'diff' && X) { const q = p.quotes.find((q) => q.rowId === X && q.supplierId === r.adoptedSupplierId && !q.stale); await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice * 2 + 20000)); await t.press('Escape'); await t.press('Escape') }
} else {
  await t.role('design'); await t.press('1')
  for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021', 'R022', 'R023', 'R024', 'R025']) { const r0 = await t.row(id); if (!r0 || r0.adoptedSupplierId || !['quoted'].includes(r0.status)) continue; await h.adoptPick(id, 3, '6', '評価用'); if ((await t.row(id)).flags.pmPending) { X = id; break } }
}
if (!X) { check(tag + '-0 前提', false, 'no row'); summary(); await t.close(); process.exit(0) }
p = await t.proj(); const r0 = p.rows.find((r) => r.id === X); log('X', h.show(p, X).slice(0, 240), 'case', await h.caseOf(X))
const qs0 = JSON.stringify(p.quotes.filter((q) => q.rowId === X && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))
await t.role('design'); await t.press('1'); await t.setCellKey(X, 'qtyNeeded', String(r0.qtyNeeded * 3 + 5)); log('publish →', (await t.publish('1')).slice(-40))
p = await t.proj(); const r1 = p.rows.find((r) => r.id === X); log('X published', h.show(p, X).slice(0, 260), 'requote', r1.flags.requote)
await t.role('purchasing'); await t.press('4'); await t.goto(X); await page.keyboard.press('Control+.'); await page.waitForTimeout(150)
let pn = await t.panel(); log('Ctrl+. panel', JSON.stringify(pn?.options))
const i = (pn?.options ?? []).findIndex((o) => /再見積要: 据え置き/.test(o)); log('keep idx', i)
if (i < 0) { check(tag + '-1 購買の Ctrl+. に「再見積要: 据え置き」が出る', !r1.flags.requote ? true : false, JSON.stringify(pn?.options)); if (await t.panel()) await page.keyboard.press('Escape'); }
else {
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); if (await t.panel()) { try { await t.promptFill('据え置き'); } catch {} ; await page.keyboard.press('Enter'); await page.waitForTimeout(150) }
  p = await t.proj(); const r2 = p.rows.find((r) => r.id === X); log('X after keep', h.show(p, X).slice(0, 300), 'ball', await h.ballOf(X), 'case', await h.caseOf(X), 'toast', (await t.toast()).slice(0, 60))
  check(tag + '-1 据え置きで再見積要が外れ、旧見積が有効に戻る', !r2.flags.requote && JSON.stringify(p.quotes.filter((q) => q.rowId === X && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays])) === qs0, h.show(p, X).slice(0, 200))
  check(tag + '-2 据え置きで採用・PM の判断の印は壊れない（採用あり／承認待ちのまま）', r2.adoptedSupplierId === r0.adoptedSupplierId && !!r2.flags.pmPending === !!r0.flags.pmPending, h.show(p, X).slice(0, 220))
  if (mode === 'formal' || mode === 'diff') check(tag + '-3 正式依頼中／正式見積済の行は、必要数を変えたので再発行（reissue）が要る印が付く（古い数量で発注しない）', r2.flags.reissue === true || r2.status === 'selected', `reissue=${r2.flags.reissue} st=${r2.status}`)
}
const vio = inv(p); check(tag + '-8 不変条件', !vio.length, vio.join('|'))
const sk = await stuck(t); check(tag + '-9 固まる行がない', sk.length === 0, sk.slice(0, 3))
errs(t, tag + '-99'); summary(); await t.close()
