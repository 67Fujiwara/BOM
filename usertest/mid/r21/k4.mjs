// k4: 最小ロット（余剰が閾値超）の PM の判断（M16-04 の修正）の先
//   mode=reject : 購買が丸める（PM 待ち）→ PM 却下（発注数が必要数に戻り指摘が購買へ）→ 購買がまた発注数 100 → 指摘・PM・正式見積の依頼
//   mode=approve: 購買が丸める（PM 待ち）→ PM 承認 → 指摘は決着、発注数 100 のまま正式見積の依頼に出る
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'reject'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.resolution ?? '']))
async function formalRows(X) { const n0 = t.downloads.length; const fm = await t.requestFormal(); const rows = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === X) rows.push(v.slice(0, 6)) }) } return { fm, rows } }
await t.open('design'); log('bulk →', await t.bulk()); let p = await t.proj()
const X = p.rows.find((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 4 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0) > 2000).id
const need = p.rows.find((r) => r.id === X).qtyNeeded
log('X', h.show(p, X))
await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.publish())
await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 (PM 待ち) →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
p = await t.proj(); log('X before PM', h.show(p, X), 'issues', iss(p, X), 'case', await h.caseOf(X))
check('K4-0 PM の判断待ちのあいだは丸めても指摘を対応済にしない（M16-04）', !p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && i.status === 'fixed'), iss(p, X))
await t.role('pm'); await t.press('7')
if (mode === 'reject') {
  const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); const r1 = p.rows.find((r) => r.id === X)
  log('X after reject', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'issues', iss(p, X))
  check('K4-1 却下で発注数が必要数に戻り、最小ロットの指摘が購買に戻る', r1.orderQty === need && p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && i.status === 'open') && (await h.ballOf(X)) === 'purchasing', `oq=${r1.orderQty} need=${need} ${iss(p, X)}`)
  // 購買の次の手
  await t.role('purchasing'); await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 260); log('purch statusbar', sb)
  await t.press('Control+.'); await page.waitForTimeout(80); const qf = (await t.panel())?.options ?? []; await t.press('Escape'); log('purch Ctrl+. options', JSON.stringify(qf))
  // 購買がまた 100 に丸める（PM が却下した余剰）
  await t.press('3'); const m2 = await t.setCellKey(X, 'orderQty', '100'); await t.press('Escape')
  p = await t.proj(); const r2 = p.rows.find((r) => r.id === X)
  log('X re-round →', m2, '|', h.show(p, X), 'issues', iss(p, X), 'case', await h.caseOf(X), 'ball', await h.ballOf(X))
  const backToPm = !!r2.flags.pmPending || (await h.caseOf(X)) === '閾値超'
  const closed = p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && ['fixed', 'confirmed'].includes(i.status))
  check('K4-2 PM が却下した余剰（発注数 100）にまた丸めても、黙って指摘が対応済にならない（PM に戻す・止める・知らせる）', backToPm || !closed || /却下|PM/.test(m2), `pm=${backToPm} closed=${closed} toast=${m2} ${iss(p, X)}`)
  const { fm, rows } = await formalRows(X); p = await t.proj()
  log('formal →', fm, 'X rows', JSON.stringify(rows), '|', h.show(p, X))
  check('K4-3 PM が却下した余剰（100）で正式見積の依頼書が出ない', !rows.some((r) => r[4] === 100), `${fm} ${JSON.stringify(rows)}`)
} else {
  const y = await t.yes(X, '余剰を受け入れる'); log('PM y →', y.toast)
  p = await t.proj(); const r1 = p.rows.find((r) => r.id === X)
  log('X after approve', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'issues', iss(p, X))
  check('K4-4 承認で最小ロットの指摘は決着（確認済）、発注数 100 のまま、PM 待ちが外れる', r1.orderQty === 100 && !r1.flags.pmPending && p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && i.status === 'confirmed'), `${h.show(p, X)} ${iss(p, X)}`)
  await t.role('purchasing'); await t.press('4'); const in4 = (await t.viewRows()).includes(X); log('purch 4 has X', in4)
  const { fm, rows } = await formalRows(X); p = await t.proj()
  log('formal →', fm, 'X rows', JSON.stringify(rows), '|', h.show(p, X))
  check('K4-5 承認した余剰（発注数 100）で正式見積の依頼書に出る', rows.some((r) => r[4] === 100), `${fm} ${JSON.stringify(rows)}`)
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k4-' + mode)
summary(); await t.close()
