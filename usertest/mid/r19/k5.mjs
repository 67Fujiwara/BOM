// k5: 選定前の行の最小ロット（閾値超）を PM が承認（M16-08 の修正: 指摘を決着）→ 選定者が「余剰を受け入れた」因幡で採る
//   期待: 指摘は確認済のまま、発注数は因幡の丸め数量 100、PM の承認した余剰で正式見積の依頼に出る（PM に余剰の判断を 2 度聞かない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.resolution ?? '']))
await t.open('design')
let p = await t.proj()
const Q = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && r.qtyNeeded <= 4 && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice > 2000 && q.leadDays >= 0).length === 3).id
log('Q', h.show(p, Q))
await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(Q, 'q.moq@S1', '100')); await t.press('Escape')
await t.press('1'); await t.goto(Q); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); const y = await t.yes(Q, '余剰を受け入れる'); log('PM y →', y.toast)
p = await t.proj(); log('Q after y', h.show(p, Q), '|', await h.status(Q), 'ball', await h.ballOf(Q), 'issues', iss(p, Q))
check('K5-1 選定前の最小ロットを PM が承認したら、指摘は決着し選定者（設計）のボール（M16-08）', p.issues.some((i) => i.rowId === Q && i.kind === '最小ロット' && i.status === 'confirmed') && (await h.ballOf(Q)) === 'design', `${iss(p, Q)} ball=${await h.ballOf(Q)}`)
await t.role('design'); await t.press('4'); log('design 4 has Q', (await t.viewRows()).includes(Q))
// 因幡（MOQ 100）を Shift+A で選ぶ
const ranks = await page.evaluate(async (X) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((x) => x.id === X), s.ws.suppliers).map((x) => [x.supplierId, x.total]) }, Q)
log('ranks', JSON.stringify(ranks)); const n = ranks.findIndex((r) => r[0] === 'S1') + 1
await t.press('1'); const ap = await h.adoptPick(Q, n, '3', 'PM 承認済の余剰で因幡'); log('adopt S1 →', ap.toast)
p = await t.proj(); let rQ = p.rows.find((r) => r.id === Q); log('Q after adopt', h.show(p, Q), '|', await h.status(Q), 'case', await h.caseOf(Q), 'issues', iss(p, Q))
const case1 = await h.caseOf(Q)
log('INFO PM の要決定', case1 || '-')
if (rQ.flags.pmPending) { await t.role('pm'); await t.press('7'); log('PM y (例外選定) →', (await t.yes(Q, 'ok')).toast); p = await t.proj(); rQ = p.rows.find((r) => r.id === Q); log('Q after 2nd y', h.show(p, Q), '|', await h.status(Q), 'issues', iss(p, Q)) }
check('K5-2 PM が余剰を受け入れた因幡で採用したら、発注数は丸め数量 100', rQ.adoptedSupplierId === 'S1' && rQ.orderQty === 100, h.show(p, Q))
check('K5-3 採用のあとに最小ロットの指摘が開き直らない（PM の承認が残る）', !p.issues.some((i) => i.rowId === Q && i.kind === '最小ロット' && ['open', 'inProgress'].includes(i.status)), iss(p, Q))
await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); const rows = []
for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === Q) rows.push(v.slice(0, 6)) }) }
log('formal →', fm, 'Q rows', JSON.stringify(rows))
check('K5-4 正式見積の依頼書に因幡・発注数 100 で出る', rows.some((r) => r[4] === 100), JSON.stringify(rows))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k5')
summary(); await t.close()
