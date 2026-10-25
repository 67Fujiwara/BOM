// a3b: キャンセル不可で戻したあとの納期NG の再判定（次の操作で）、承認後まだ外していない行の見送り、置換先を消してから戻す
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return r ? `${rid}:${r.status}:ord=${!!r.ordered}:prom=${r.promisedDate ?? '-'}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}${i.pmRuled ? ':ruled' : ''}`).join(',')}` : rid + ':none' }
const [B, C, E, F] = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).map((r) => r.id)
await t.press('8')
for (const id of [B, C, E, F]) { const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
for (const id of [B, C, E, F]) await t.order(id)
async function raiseH(id, text) { await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill(text); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); return t.publish() }
async function unorder(id) { await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); return t.toast() }
async function restore(id) { await t.goto(id); await t.press('Home'); await t.cmd('キャンセル不可で発注に戻す', 'キャンセル不可'); await page.waitForTimeout(80); const pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(100) } return t.toast() }
// ---- E: 発注済の納期NG → d → 承認 → 外す → 戻す → 次の操作
await t.showCol('promisedDate'); await t.setCellKey(E, 'promisedDate', '2026-12-20'); await t.press('Escape')
await t.role('pm'); await t.press('7'); log('PM d E', (await t.decide(E, 'd', '代替品を検討')).toast)
await t.role('design'); await t.press('1'); await t.goto(E); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); await t.press('2'); await page.waitForTimeout(60); await t.promptFill('代替候補 XYZ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80); await t.press('Escape'); await t.press('Escape')
log('h E →', await raiseH(E, '取消して XYZ へ'))
await t.role('pm'); await t.press('7'); log('PM y E →', (await t.yes(E, '承認')).toast)
log('unorder E →', await unorder(E))
log('restore E →', await restore(E)); p = await t.proj(); log('E right after restore', st(p, E))
await t.role('pm'); await t.press('7'); const pm7a = (await t.viewRows()).includes(E)
// 別の行の操作（ロット入力）で再計算が走る
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.showCol('receivedLot'); await t.setCellKey(F, 'receivedLot', 'LOT-9'); await t.press('Escape')
p = await t.proj(); log('E after an unrelated edit', st(p, E))
await t.role('pm'); await t.press('7'); const pm7b = (await t.viewRows()).includes(E); let pn = null
if (pm7b) { await t.goto(E); await t.press('Enter'); await page.waitForTimeout(80); pn = await t.panel(); if (pn) await t.press('Escape') }
log('PM 7: right after restore', pm7a, '/ after unrelated edit', pm7b, JSON.stringify(pn?.title), JSON.stringify(pn?.options))
check('A3b-1 戻した直後から、入荷予定が必要日を超える行は納期NG（発注済）で PM の 7 に出る（別の操作を待たない）', pm7a && pm7b, `${pm7a}/${pm7b}`)
check('A3b-2 PM の決定パネルは発注済の納期NG（e と 受入）', /特急/.test(JSON.stringify(pn?.options ?? [])) && !/次点/.test(JSON.stringify(pn?.options ?? [])), JSON.stringify(pn?.options))
// ---- B: 承認 → 外す前に取引先が断る → 指摘を見送り
log('h B →', await raiseH(B, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y B →', (await t.yes(B, '承認')).toast)
await t.role('purchasing'); await t.press('1'); await t.goto(B); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); await t.press('6'); await page.waitForTimeout(80); const pr6 = await t.panel(); log('6 prompt', pr6?.title); if (pr6?.kind === 'prompt') { await t.promptFill('取引先がキャンセル不可'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } const mk = await t.toast(); if (await t.panel()) await t.press('Escape'); await t.press('Escape'); if (await t.panel()) await t.press('Escape')
p = await t.proj(); log('B after 見送り', mk, st(p, B), 'ball', await t.cellText(B, 'ball'))
await t.press('4'); const pu4 = (await t.viewRows()).includes(B)
log('unorder B after 見送り →', await unorder(B)); p = await t.proj(); log('B', st(p, B))
check('A3b-3 外す前に断られたら、購買が発注後変更依頼を見送りにして発注済のまま閉じられる（購買の 4 から消え、外せない）', p.rows.find((r) => r.id === B).ordered && !pu4 && p.issues.some((i) => i.rowId === B && i.kind === '発注後変更依頼' && i.status === 'wontfix'), `pu4=${pu4} ${st(p, B)}`)
// ---- C: 外す → 設計 r（作業中）→ 設計が置換先を Shift+Delete → 戻す
log('h C →', await raiseH(C, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y C →', (await t.yes(C, '承認')).toast)
log('unorder C →', await unorder(C))
await t.role('design'); await t.press('1'); log('design r C →', await t.replace(C, 'NEW-C1'))
p = await t.proj(); const nid = p.rows.find((r) => r.replaces === C)?.id; log('new row', nid)
await t.goto(nid); await t.press('Shift+Delete'); await page.waitForTimeout(100); const pnD = await t.panel(); if (pnD?.kind === 'prompt') { log('del prompt', pnD.title, JSON.stringify(pnD.options)); const i = pnD.options.findIndex((o) => /消す|削除|取りやめ/.test(o)); for (let k = 0; k < Math.max(0, i); k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(100) }
p = await t.proj(); log('after delete new row →', await t.toast(), st(p, C), 'new', !!p.rows.find((r) => r.id === nid))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); const rc = await restore(C); p = await t.proj(); log('restore C →', rc, st(p, C))
check('A3b-4 設計が置換先を消したら、購買が戻せる', p.rows.find((r) => r.id === C).ordered, rc)
// ---- 置換を公開してしまったあとは？
summary(); await t.close()
