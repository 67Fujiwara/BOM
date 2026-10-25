// i5: 最小ロットの余剰が閾値超 → PM（M14-09 の修正）の先の流れ
//   mode=sel   : 選定済の行 → PM の y（余剰を受入）→ 購買が発注数を丸める → 正式見積の依頼書の発注数
//   mode=quoted: 選定前（見積済）の行 → PM の y
//   mode=reject: 選定済の行 → PM の Shift+Y（却下 → 起票者に戻す）。閾値以下の行は PM に載らない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'sel'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.text.slice(0, 70)]))
async function raiseMinLot(id, sid, moq) {
  await t.role('purchasing'); await t.press('6'); log('moq', id, sid, moq, '→', await t.setCellKey(id, `q.moq@${sid}`, String(moq))); await t.press('Escape')
  await t.press('1'); await t.goto(id); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  const pre = (await page.getByTestId('issue-text').count()) ? await page.getByTestId('issue-text').inputValue() : ''
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  log('raise →', await t.toast(), '| text', pre); log('publish →', await t.publish())
}
await t.open('design')
let p = await t.proj()
if (mode === 'quoted') {
  const Q = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && r.qtyNeeded <= 4 && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice > 2000 && q.leadDays >= 0).length === 3).id
  log('Q', h.show(p, Q))
  await raiseMinLot(Q, 'S1', 100)
  p = await t.proj(); log('Q after', h.show(p, Q), 'issues', iss(p, Q), 'ball', await h.ballOf(Q), 'case', await h.caseOf(Q))
  await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(Q); log('PM 7 has Q', in7)
  const y = await t.yes(Q, '余剰を受け入れる'); log('PM y →', y.toast)
  p = await t.proj(); const rQ = p.rows.find((r) => r.id === Q); log('Q after y', h.show(p, Q), '|', await h.status(Q), 'ball', await h.ballOf(Q), 'issues', iss(p, Q))
  check('I5-1 選定前の行の最小ロット（閾値超）を PM が承認しても、採用の無い「選定済」にしない（見積済のまま選定者へ、または丸める商社で採用）', !(rQ.status === 'selected' && !rQ.adoptedSupplierId), `${h.show(p, Q)} | ${await h.status(Q)}`)
  await t.role('design'); await t.press('1'); await t.goto(Q); await t.press('a'); await page.waitForTimeout(80); const ma = await t.toast(); p = await t.proj(); log('design a Q →', ma, '|', h.show(p, Q))
  await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0); p = await t.proj()
  log('formal →', fm, JSON.stringify(f0.map((f) => [f.sup, f.ids.includes(Q)])), '|', h.show(p, Q))
  check('I5-2 その行は正式見積の依頼まで進められる', f0.some((f) => f.ids.includes(Q)), `${fm} / ${h.show(p, Q)}`)
} else {
  log('bulk →', await t.bulk()); p = await t.proj()
  const cands = p.rows.filter((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 4 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0) > 2000)
  const X = cands[0].id
  log('X', h.show(p, X), 'surplusAmount', p.settings.surplusAmount)
  await raiseMinLot(X, 'S1', 100)
  p = await t.proj(); log('X after', h.show(p, X), 'issues', iss(p, X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
  await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('PM 7 has X', in7)
  check('I5-0 余剰が閾値超の最小ロットは PM の 7 に「閾値超」で載る', in7 && (await h.caseOf(X)) === '閾値超', `in7=${in7} case=${await h.caseOf(X)}`)
  if (mode === 'sel') {
    const dec = await t.decide(X, 'y', '余剰を受け入れる'); log('PM panel', JSON.stringify(dec.panel?.options ?? []), '→', dec.toast)
    p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
    log('X after y', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'issues', iss(p, X), 'orderQty', rX.orderQty)
    check('I5-3 PM の承認のあと、行は採用のまま購買のボール（最小ロットの指摘は購買が丸める）', rX.adoptedSupplierId === 'S1' && (await h.ballOf(X)) === 'purchasing', `${h.show(p, X)} ball=${await h.ballOf(X)}`)
    // 購買が発注数を 100 に
    await t.role('purchasing'); await t.press('3'); await t.showCol('orderQty'); log('orderQty →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
    p = await t.proj(); log('X after orderQty', h.show(p, X), 'issues', iss(p, X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
    // 指摘の確認（x）
    await t.press('1'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 200); log('statusbar', sb)
    await t.press('x'); await page.waitForTimeout(80); log('x →', await t.toast()); p = await t.proj(); log('issues after x', iss(p, X))
    const n0 = t.downloads.length; const fm = await t.requestFormal(); p = await t.proj()
    const rows = []
    for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === X) rows.push(v.slice(0, 8)) }) }
    log('formal →', fm, 'X row', JSON.stringify(rows), '|', h.show(p, X))
    check('I5-4 PM が余剰を受け入れた行は、丸めた発注数（100）で正式見積を依頼できる', rows.some((r) => r[4] === 100), JSON.stringify(rows))
    check('I5-5 最小ロットの指摘は、発注数を丸めたあと開いたまま残らない（確認できる）', !p.issues.some((i) => i.rowId === X && i.kind === '最小ロット' && ['open', 'inProgress'].includes(i.status)), iss(p, X))
  } else {
    const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる。MOQ の小さい商社で'); log('PM Shift+Y →', dec.toast, '| prompt', dec.prompt?.title)
    p = await t.proj(); log('X after Shift+Y', h.show(p, X), '|', await h.status(X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X), 'issues', iss(p, X))
    check('I5-6 PM の却下で行は起票者（購買）に戻り、7 から外れる', (await h.ballOf(X)) === 'purchasing' && (await h.caseOf(X)) === 'なし', `ball=${await h.ballOf(X)} case=${await h.caseOf(X)}`)
    const bQ = p.rows.find((r) => r.id !== X && r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 10 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 1e9) < 500)
    const moq = bQ.qtyNeeded + 5
    await raiseMinLot(bQ.id, 'S1', moq)
    p = await t.proj(); log('small', h.show(p, bQ.id), 'issues', iss(p, bQ.id), 'case', await h.caseOf(bQ.id))
    check('I5-7 余剰が閾値以下の最小ロットは PM に載らない（購買が丸める）', (await h.caseOf(bQ.id)) === 'なし', `case=${await h.caseOf(bQ.id)}`)
    // 却下のあと購買が発注数を丸めてしまえるか（PM が却下した余剰で発注しない）
    await t.role('purchasing'); await t.press('3'); await t.showCol('orderQty'); const oqm = await t.setCellKey(X, 'orderQty', '100'); await t.press('Escape')
    p = await t.proj(); log('orderQty 100 after PM reject →', oqm, '|', h.show(p, X), 'case', await h.caseOf(X))
    log('INFO 却下後に発注数 100', p.rows.find((r) => r.id === X).orderQty === 100 ? 'そのまま入る（PM に戻らない）' : '止まる')
  }
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i5-' + mode)
summary(); await t.close()
