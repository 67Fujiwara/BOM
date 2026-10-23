// a3: 発注後変更依頼 → PM 承認 → 外す → キャンセル不可で発注に戻す（M7-03）。承認後まだ外していない行、納期NG→d の経路、設計が置換を作業中、役割・Undo の文
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return r ? `${rid}:${r.status}:ord=${!!r.ordered}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}${i.pmRuled ? ':ruled' : ''}${i.resolution ? '「' + i.resolution + '」' : ''}`).join(',')}` : rid + ':none' }
const cands = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).map((r) => r.id)
const [A, B, C, E] = cands
log('rows', A, B, C, E)
await t.press('8')
for (const id of [A, B, C, E]) { const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
for (const id of [A, B, C, E]) log('o', id, await t.order(id))
async function raiseH(id, text) { await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill(text); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); return t.publish() }
async function unorder(id) { await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); return t.toast() }
async function restore(id, confirm = true) {
  await t.goto(id); await t.press('Home')
  await t.cmd('キャンセル不可で発注に戻す', 'キャンセル不可'); await page.waitForTimeout(80)
  const pn = await t.panel()
  if (pn?.kind === 'prompt') { if (confirm) { const i = pn.options.findIndex((o) => /戻す/.test(o)); for (let k = 0; k < i; k++) await t.press('ArrowDown') } await t.press('Enter'); await page.waitForTimeout(100) }
  return { title: pn?.title, options: pn?.options, toast: await t.toast() }
}
// ---- A: 承認 → 外す → 他の作業 → 取引先が断る → 戻す
log('h A →', await raiseH(A, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y A →', (await t.yes(A, '承認')).toast)
log('unorder A →', await unorder(A))
await t.showCol('receivedLot'); await t.setCellKey(B, 'receivedLot', 'LOT-1'); await t.press('Escape')
p = await t.proj(); log('A before restore', st(p, A), 'ball', await t.cellText(A, 'ball'))
// 購買の o の文に案内があるか
await t.goto(A); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); const oMsg = await t.toast(); log('o on A →', oMsg)
check('A3-1 o の止める文に「キャンセル不可で発注に戻す」の案内', /キャンセル不可で発注に戻す/.test(oMsg), oMsg)
// 設計が palette を使ったら
await t.role('design'); await t.press('1'); const dz = await restore(A); log('design restore →', JSON.stringify(dz))
p = await t.proj(); check('A3-2 設計は戻せない（権限なし）', !p.rows.find((r) => r.id === A).ordered, dz.toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
const pz = await restore(A); log('purch restore →', JSON.stringify(pz))
p = await t.proj(); log('A after restore', st(p, A), 'ball', await t.cellText(A, 'ball'))
const rA = p.rows.find((r) => r.id === A)
check('A3-3 (M7-03) 購買の「キャンセル不可で発注に戻す」で発注済・対策区分なし・発注後変更依頼は「キャンセル不可」で閉じる', rA.ordered && rA.status === 'ordered' && !rA.flags.countermeasure && p.issues.some((i) => i.rowId === A && i.kind === '発注後変更依頼' && /キャンセル不可/.test(i.resolution ?? '')), st(p, A))
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(A); await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(A); await t.role('purchasing'); await t.press('4'); const pu4 = (await t.viewRows()).includes(A)
log('after restore: design4', d4, 'pm7', pm7, 'purch4', pu4)
check('A3-4 戻した行は設計の 4・PM の 7 から消える', !d4 && !pm7)
// 記録: 詳細・履歴・Excel 変更点（決定の記録として残るか）
await t.press('1'); await t.goto(A); await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); await t.press(' ')
log('detail A', det.slice(0, 600))
check('A3-5 詳細に「キャンセル不可」の経緯が残る', /キャンセル不可/.test(det), '')
p = await t.proj(); log('events', JSON.stringify(p.events?.filter((e) => (e.text ?? '').includes(A)).slice(-4).map((e) => e.text)))
// Undo: 戻すを Ctrl+Z
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(A)
await t.press('Control+z'); await page.waitForTimeout(100); const uz = await t.toast(); p = await t.proj(); log('Ctrl+Z after restore →', uz, st(p, A))
check('A3-6 押し間違いの「戻す」は Ctrl+Z で外した状態に戻せる（または理由が分かる文）', !p.rows.find((r) => r.id === A).ordered || /外しません|戻せません/.test(uz), uz)
const undoneA = !p.rows.find((r) => r.id === A).ordered
await t.press('Control+z'); await page.waitForTimeout(100); const uz2 = await t.toast(); p = await t.proj(); log('Ctrl+Z #2 →', uz2, st(p, A), 'B lot', p.rows.find((r) => r.id === B).receivedLot)
await t.press('Control+y'); await page.waitForTimeout(100); const yz = await t.toast(); p = await t.proj(); log('Ctrl+Y →', yz, st(p, A))
// もう一度外せるか（戻したあとで取引先がやっぱり受けた）
const re = await unorder(A); p = await t.proj(); log('unorder again after restore →', re, st(p, A))
// ---- B: 承認されたが、外す前に取引先に聞いたら断られた（外していない）
log('h B →', await raiseH(B, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y B →', (await t.yes(B, '承認')).toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
p = await t.proj(); log('B approved, still ordered', st(p, B), 'ball', await t.cellText(B, 'ball'))
const rb = await restore(B); log('restore B (not unordered) →', JSON.stringify(rb))
await t.goto(B); await t.press('Home'); const sbB = await t.status(); await t.press('Control+.'); await page.waitForTimeout(80); const qfB = await t.panel(); if (qfB) await t.press('Escape')
await t.press('4'); const pu4B = (await t.viewRows()).includes(B)
log('B status bar', sbB.slice(0, 200), 'Ctrl+.', JSON.stringify(qfB?.options), 'purch4', pu4B)
// 指摘パネルで閉じられるか（見送り）
await t.press('1'); await t.goto(B); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); const ipB = await t.panel(); log('issue panel B', ipB?.title, JSON.stringify(ipB?.options)); if (ipB) await t.press('Escape'); await t.press('Escape'); if (await t.panel()) await t.press('Escape')
check('A3-7 承認後まだ外していない行で取引先が断ったとき、依頼を閉じる手段がある（戻す・見送り・案内）', /キャンセル|見送り|閉じ/.test(rb.toast + JSON.stringify(qfB?.options ?? []) + JSON.stringify(ipB?.options ?? [])) && !/ではありません/.test(rb.toast), `${rb.toast} / ${JSON.stringify(ipB?.options)}`)
// ---- C: 設計が置換を作業中（未公開）で戻す
log('h C →', await raiseH(C, '取消したい'))
await t.role('pm'); await t.press('7'); log('PM y C →', (await t.yes(C, '承認')).toast)
log('unorder C →', await unorder(C))
await t.role('design'); await t.press('1'); log('design r C →', await t.replace(C, 'NEW-C1'))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); const rc = await restore(C); p = await t.proj(); log('restore C while design replacing →', JSON.stringify(rc), st(p, C))
check('A3-8 設計の置換が作業中なら戻さず理由を出す', !p.rows.find((r) => r.id === C).ordered && /置換|置き換え/.test(rc.toast), rc.toast)
// 設計が置換をやめたら戻せるか
await t.role('design'); await t.press('1'); await t.goto(C); await t.press('Shift+Delete'); await page.waitForTimeout(100); const sd = await t.toast(); const pnC = await t.panel(); if (pnC) { log('shift+del panel', pnC.title, JSON.stringify(pnC.options)); await t.press('Escape') }
p = await t.proj(); log('design Shift+Delete on C →', sd, st(p, C), 'removal', JSON.stringify(p.rows.find((r) => r.id === C).removal))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); const rc2 = await restore(C); p = await t.proj(); log('restore C after design cancels →', JSON.stringify(rc2), st(p, C))
// ---- E: 納期NG → d の経路（発注済の納期NG）
await t.showCol('promisedDate'); await t.setCellKey(E, 'promisedDate', '2026-12-20'); await t.press('Escape')
p = await t.proj(); log('E late', st(p, E))
await t.role('pm'); await t.press('7'); log('PM d E', (await t.decide(E, 'd', '代替品を検討')).toast)
await t.role('design'); await t.press('1'); await t.goto(E); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); await t.press('2'); await page.waitForTimeout(60); await t.promptFill('代替候補 XYZ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80); await t.press('Escape'); await t.press('Escape')
log('h E →', await raiseH(E, '取消して XYZ へ'))
await t.role('pm'); await t.press('7'); log('PM y E →', (await t.yes(E, '承認')).toast)
log('unorder E →', await unorder(E))
const re2 = await restore(E); p = await t.proj(); log('restore E →', JSON.stringify(re2), st(p, E))
await t.role('pm'); await t.press('7'); const pm7E = (await t.viewRows()).includes(E); let pnE = null
if (pm7E) { await t.goto(E); await t.press('Enter'); await page.waitForTimeout(80); pnE = await t.panel(); if (pnE) await t.press('Escape') }
log('E in PM 7 after restore', pm7E, JSON.stringify(pnE?.title), JSON.stringify(pnE?.options))
check('A3-9 納期NG の代替がキャンセル不可で戻ったら、発注済の納期NG として PM の 7 に戻り e / 受入 を選べる', pm7E && /e|特急/.test(JSON.stringify(pnE?.options ?? [])), `${pm7E} ${JSON.stringify(pnE?.options)}`)
await t.shot('a3-restore')
summary(); await t.close()
