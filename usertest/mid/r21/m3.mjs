// m3: 最小ロットの余剰（因幡 MOQ 100）を PM が決めたあとの必要数の変更・選び直し（M18-01 の修正の先）
//   mode=qtycheck: 却下 → 購買が「発注数要確認」を x で確認 → 設計が必要数 +1 で公開 → 発注数は必要数、購買が手で変えていないので「発注数要確認」は付かない
//   mode=same    : 因幡しか回答の無い行（立花・ミスミ 取扱なし）で却下 → 選定者が a（推奨＝因幡）で採り直す → 発注数が黙って 100 にならない
//   mode=approved: PM が余剰を承認（100）→ 設計が必要数を 24 → 30（発注数 100 のまま）→ 130（発注数 130）。却下の印は残らない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'qtycheck'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status]))
async function raiseMinLot(X) {
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  return t.publish()
}
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const price = (r) => p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0
const cand = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 5 && r.qtyNeeded <= 40 && (100 - r.qtyNeeded - 1) * price(r) > 25000)
const X = cand[0].id; const need = cand[0].qtyNeeded
log('X', h.show(p, X))
await t.role('purchasing'); await t.press('6')
if (mode === 'same') { for (const sid of ['S2', 'S3']) log('decline', sid, '→', await h.decline(X, sid)) }
log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
log('raise →', await raiseMinLot(X))
await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 (PM 待ち) →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
p = await t.proj(); log('case', await h.caseOf(X), h.show(p, X))
await t.role('pm'); await t.press('7')
if (mode === 'approved') {
  log('PM y →', (await t.yes(X, '余剰を受け入れる')).toast); p = await t.proj(); let rX = p.rows.find((r) => r.id === X)
  log('after approve', h.show(p, X), iss(p, X))
  await t.role('design'); await t.press('1'); log('qty 30 →', await t.setCellKey(X, 'qtyNeeded', '30')); log('publish →', await t.publish('1'))
  p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after 30', h.show(p, X))
  check('M3A-1 承認した余剰のまま必要数 30 にすると発注数は MOQ の 100（却下の印なし、発注数要確認なし）', rX.orderQty === 100 && !rX.flags.surplusRejected && !rX.flags.orderQtyCheck, h.show(p, X))
  log('qty 130 →', await t.setCellKey(X, 'qtyNeeded', '130')); log('publish →', await t.publish('1'))
  p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after 130', h.show(p, X))
  check('M3A-2 必要数 130（MOQ 超）で発注数 130', rX.orderQty === 130, h.show(p, X))
  log('qty 10 →', await t.setCellKey(X, 'qtyNeeded', '10')); log('publish →', await t.publish('1'))
  p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('INFO after 10（余剰 90 個。承認したときの 76 個より多い）', h.show(p, X), 'case', await h.caseOf(X), iss(p, X))
} else {
  const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); let rX = p.rows.find((r) => r.id === X)
  log('after reject', h.show(p, X), iss(p, X))
  if (mode === 'qtycheck') {
    await t.role('purchasing'); await t.press('3'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 200); await t.press('x'); await page.waitForTimeout(100)
    p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('x →', await t.toast(), '| sb before', sb, '|', h.show(p, X))
    check('M3Q-0 購買が x で発注数要確認を確認できる', !rX.flags.orderQtyCheck, h.show(p, X))
    await t.role('design'); await t.press('1'); log('qty +1 →', await t.setCellKey(X, 'qtyNeeded', String(need + 1))); log('publish →', await t.publish('1'))
    p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after qty', h.show(p, X))
    check('M3Q-1 発注数は新しい必要数 ' + (need + 1) + '（却下した余剰に戻らない）', rX.orderQty === need + 1, h.show(p, X))
    check('M3Q-2 購買が発注数を手で変えていない（却下で戻した数のまま）ので「発注数要確認」は付かない（§4 発注数要確認の条件）', !rX.flags.orderQtyCheck, h.show(p, X))
    await t.role('purchasing'); await t.goto(X); await t.press('Home'); log('purch statusbar X', (await t.status()).slice(0, 200))
  } else {
    await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(120); const m = await t.toast()
    p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('a →', m, '|', h.show(p, X), 'case', await h.caseOf(X))
    check('M3S-1 PM が却下した因幡の余剰を、選定者が a で因幡に採り直しても発注数が黙って 100 にならない（必要数のまま・知らせる・PM に戻す）', !(rX.adoptedSupplierId === 'S1' && rX.orderQty === 100 && !rX.flags.pmPending) || /却下/.test(m), `${h.show(p, X)} toast=${m}`)
    await t.role('pm'); await t.press('7'); log('PM 7 has X', (await t.viewRows()).includes(X))
    await t.role('purchasing'); const n0 = t.downloads.length; log('formal →', await t.requestFormal()); const fr = (await h.files(n0)); const ExcelJS = (await import('/home/user/BOM/node_modules/exceljs/excel.js')).default
    const rows = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === X) rows.push(v.slice(0, 6)) }) }
    log('formal X', JSON.stringify(rows), fr.length)
    check('M3S-2 PM が却下した余剰（因幡 100）で正式見積の依頼書が出ない', !rows.some((r) => r[4] === 100), JSON.stringify(rows))
  }
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
