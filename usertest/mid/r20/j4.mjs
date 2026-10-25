// j4: 最小ロットの閾値超（PM が A）と、発注数の丸めで指摘を閉じる修正（M15-06）の組み合わせ
//   購買が最小ロット（余剰が閾値超）を起票 → PM が決める前に購買が発注数を 100 に → 指摘・PM の 7 は？
//   → PM が却下（Shift+Y）→ 発注数 100 のまま正式見積の依頼に出るか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.resolution ?? '']))
await t.open('design'); log('bulk →', await t.bulk()); let p = await t.proj()
const X = p.rows.find((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 4 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0) > 2000).id
log('X', h.show(p, X))
await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
if (await page.getByTestId('issue-text').count()) { log('text', await page.getByTestId('issue-text').inputValue()); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.publish())
p = await t.proj(); log('X after raise', h.show(p, X), 'issues', iss(p, X), 'case', await h.caseOf(X), 'ball', await h.ballOf(X))
// PM が決める前に購買が丸める
await t.press('3'); await t.showCol('orderQty'); const m1 = await t.setCellKey(X, 'orderQty', '100'); await t.press('Escape')
p = await t.proj(); const rX1 = p.rows.find((r) => r.id === X)
log('orderQty 100 before PM →', m1, '|', h.show(p, X), 'issues', iss(p, X), 'case', await h.caseOf(X))
const fixedBeforePm = p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && i.status === 'fixed')
log('INFO PM の判断の前に丸めた発注数', rX1.orderQty, '指摘', fixedBeforePm ? '対応済になった' : '開いたまま', 'PM 7', await h.caseOf(X))
await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('PM 7 has X', in7)
check('J4-1 PM の判断の前に購買が丸めても、閾値超の余剰は PM の 7 に残る（PM の A を飛ばさない）', in7 && (await h.caseOf(X)) === '閾値超', `in7=${in7} case=${await h.caseOf(X)}`)
const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる。MOQ の小さい商社で'); log('PM Shift+Y →', dec.toast)
p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
log('X after reject', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'issues', iss(p, X))
await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal()
const rows = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === X) rows.push(v.slice(0, 6)) }) }
p = await t.proj(); log('formal →', fm, 'X row', JSON.stringify(rows), '|', h.show(p, X), 'issues', iss(p, X))
check('J4-2 PM が却下した余剰（発注数 100）のまま正式見積の依頼書が出ない（却下で発注数が戻る・止まる・購買に知らせる）', !rows.some((r) => r[4] === 100), `${fm} / ${JSON.stringify(rows)} issues=${iss(p, X)}`)
check('J4-3 PM が却下した最小ロットの指摘が「対応済（発注数を 100 に）」で閉じたままにならない', !p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && ['fixed', 'confirmed'].includes(i.status) && /100/.test(i.resolution ?? '')), iss(p, X))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j4')
summary(); await t.close()
