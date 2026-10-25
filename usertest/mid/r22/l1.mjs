// l1: 最小ロットの余剰（閾値超）を PM が却下したあと（M17-02 の修正「却下を覚え、同じ商社のまま発注数を丸め直さない」）の先
//   mode=block  : 却下 → 購買が発注数 100 を打つ（止まる・知らせ）→ 最小ロットの指摘を発行し直す → PM の 7 にまた載る → 承認 → 100 を打てる → 正式見積 100
//   mode=qty    : 却下 → 設計が必要数を +1（±20% 以内）で公開 → 発注数の自動の再計算が却下した余剰に戻らないか → 正式見積の依頼書
//   mode=readopt: 却下 → 選定者が立花に選び直す → 因幡に選び直す（採用時の発注数の自動設定）→ 正式見積の依頼書
//   mode=pre    : 選定前の最小ロット（因幡 MOQ 100）を PM が却下 → 選定者が因幡で採る（推奨なら a、でなければ Shift+A）→ 発注数・正式見積
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'block'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.resolution ?? '']))
async function formalRows(X) { const n0 = t.downloads.length; const fm = await t.requestFormal(); const rows = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); let sup = ''; wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0) sup = v[j + 1]; if (v[0] === X) rows.push([sup, ...v.slice(0, 6)]) }) } return { fm, rows } }
async function raiseMinLot(X) {
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  if (await t.panel()) { const m = await t.toast(); await page.keyboard.press('Escape'); await page.waitForTimeout(60); if (await t.panel()) await page.keyboard.press('Escape'); return 'REFUSED ' + m }
  return t.publish()
}
const ranksOf = (X) => page.evaluate(async (X) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((x) => x.id === X), s.ws.suppliers).map((x) => [x.supplierId, x.total]) }, X)

await t.open('design')
let p
if (mode === 'pre') {
  p = await t.proj()
  const Q = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && r.qtyNeeded <= 4 && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice > 2000 && q.leadDays >= 0).length === 3).id
  log('Q', h.show(p, Q))
  await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(Q, 'q.moq@S1', '100')); await t.press('Escape')
  log('raise →', await raiseMinLot(Q))
  p = await t.proj(); log('Q case', await h.caseOf(Q), h.show(p, Q))
  await t.role('pm'); await t.press('7'); const dec = await t.decide(Q, 'Shift+Y', '余剰 99 個は受け入れない'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); log('Q after reject', h.show(p, Q), '|', await h.status(Q), 'ball', await h.ballOf(Q), 'issues', iss(p, Q))
  const ranks = await ranksOf(Q); log('ranks', JSON.stringify(ranks))
  await t.role('design'); await t.press('1')
  const n = ranks.findIndex((r) => r[0] === 'S1') + 1
  let msg
  if (n === 1) { await t.goto(Q); await t.press('a'); await page.waitForTimeout(100); msg = await t.toast() } else msg = (await h.adoptPick(Q, n, '6', '因幡で')).toast
  p = await t.proj(); const rQ = p.rows.find((r) => r.id === Q)
  log('adopt S1 (rank', n, ') →', msg, '|', h.show(p, Q), 'case', await h.caseOf(Q), 'issues', iss(p, Q))
  if (rQ.flags.pmPending) log('INFO 例外選定で PM へ（PM は余剰の却下を知っている）', rQ.flags.pmReason)
  else check('L1P-1 PM が却下した余剰（因幡 MOQ 100）を、選定者が因幡で採っても黙って発注数 100 にならない（必要数のまま・PM に戻す・知らせる）', !(rQ.adoptedSupplierId === 'S1' && rQ.orderQty === 100) || /却下|PM/.test(msg), `${h.show(p, Q)} toast=${msg}`)
  if (!rQ.flags.pmPending && rQ.adoptedSupplierId === 'S1') {
    await t.role('purchasing'); const { fm, rows } = await formalRows(Q); log('formal →', fm, JSON.stringify(rows))
    check('L1P-2 PM が却下した余剰で正式見積の依頼書が出ない（因幡宛 100）', !rows.some((r) => r[5] === 100), JSON.stringify(rows))
  }
} else {
  log('bulk →', await t.bulk()); p = await t.proj()
  const price = (r) => p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0
  const cand = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed)
  const X = (mode === 'qty' ? cand.find((r) => r.qtyNeeded >= 5 && r.qtyNeeded <= 40 && (100 - r.qtyNeeded - 1) * price(r) > 25000) : cand.find((r) => r.qtyNeeded <= 4 && price(r) > 2000))?.id
  if (!X) { log('NO X', JSON.stringify(cand.map((r) => [r.id, r.qtyNeeded, price(r)]))); process.exit(0) }
  const need = p.rows.find((r) => r.id === X).qtyNeeded
  log('X', h.show(p, X))
  await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
  log('raise →', await raiseMinLot(X))
  await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 (PM 待ち) →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
  await t.role('pm'); await t.press('7'); const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); let rX = p.rows.find((r) => r.id === X)
  log('X after reject', h.show(p, X), 'oq', rX.orderQty, 'issues', iss(p, X))
  check('L1-0 却下で発注数が必要数に戻る（M16-04）', rX.orderQty === need, `oq=${rX.orderQty} need=${need}`)
  if (mode === 'block') {
    await t.role('purchasing'); await t.press('3'); const m2 = await t.setCellKey(X, 'orderQty', '100'); await t.press('Escape')
    p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('re-round 100 →', m2, '| oq', rX.orderQty, iss(p, X))
    check('L1B-1 却下のあと同じ商社で発注数 100 は入らず、理由（PM の却下）が出る（M17-02）', rX.orderQty === need && /却下/.test(m2), `oq=${rX.orderQty} msg=${m2}`)
    const m3 = await t.setCellKey(X, 'orderQty', String(need)); await t.press('Escape'); log('orderQty = need →', m3)
    // 最小ロットの指摘を発行し直す（PM にもう一度相談）
    const rr = await raiseMinLot(X); log('re-raise →', rr)
    check('L1B-1b 知らせのとおり「最小ロットの指摘を発行し直す」とそのまま発行できる（同じ指摘が開いていると断られない）', !/REFUSED/.test(rr), rr)
    if (/REFUSED/.test(rr)) {
      // 回避: 開いている I-0xx を見送りにしてから起票し直す
      await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); log('purch Ctrl+. options', JSON.stringify(qf?.options))
      const k = (qf?.options ?? []).findIndex((o) => /見送り/.test(o))
      if (k >= 0) { for (let i = 0; i < k; i++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); await t.promptFill('PM に再相談するため出し直す'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); log('見送り →', await t.toast()) } else await t.press('Escape')
      log('re-raise 2 →', await raiseMinLot(X))
    }
    p = await t.proj(); rX = p.rows.find((r) => r.id === X)
    log('after re-raise', h.show(p, X), 'case', await h.caseOf(X), iss(p, X))
    const reRaisedOk = rX.flags.pmPending && rX.flags.pmReason === '閾値超'
    check('L1B-2 最小ロットの指摘を発行し直すと、PM の 7 にまた「閾値超」で載る（対応表 M17-02）', reRaisedOk, h.show(p, X))
    await t.role('purchasing'); await t.press('3'); const m4 = await t.setCellKey(X, 'orderQty', '100'); await t.press('Escape'); p = await t.proj(); log('round during 2nd PM wait →', m4, 'oq', p.rows.find((r) => r.id === X).orderQty)
    await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(X, '今回は受け入れる')).toast)
    p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after approve', h.show(p, X), iss(p, X))
    if (rX.orderQty !== 100) { await t.role('purchasing'); await t.press('3'); log('round after approve →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape'); p = await t.proj(); rX = p.rows.find((r) => r.id === X) }
    check('L1B-3 2 回目に PM が承認したら発注数 100 にでき、指摘は確認済', rX.orderQty === 100 && !rX.flags.surplusRejected && p.issues.filter((i) => i.rowId === X && i.kind === '最小ロット').every((i) => ['confirmed', 'wontfix'].includes(i.status)), `${h.show(p, X)} ${iss(p, X)}`)
    await t.role('purchasing'); const { fm, rows } = await formalRows(X); log('formal →', fm, JSON.stringify(rows))
    check('L1B-4 承認した余剰（100）で正式見積の依頼書に出る', rows.some((r) => r[5] === 100), JSON.stringify(rows))
  } else if (mode === 'qty') {
    await t.role('design'); await t.press('1'); log('qty +1 →', await t.setCellKey(X, 'qtyNeeded', String(need + 1))); log('publish →', await t.publish('1'))
    p = await t.proj(); rX = p.rows.find((r) => r.id === X)
    log('X after qty', h.show(p, X), 'oq', rX.orderQty, '|', await h.status(X), 'case', await h.caseOf(X), iss(p, X))
    check('L1Q-1 却下のあと必要数を変えても、発注数が却下した余剰（因幡 MOQ 100）に自動で戻らない（必要数 ' + (need + 1) + ' または PM に戻す）', rX.orderQty !== 100 || rX.flags.pmPending, `oq=${rX.orderQty} pm=${rX.flags.pmReason ?? '-'}`)
    await t.role('purchasing'); const { fm, rows } = await formalRows(X); log('formal →', fm, JSON.stringify(rows))
    check('L1Q-2 PM が却下した余剰（100）で正式見積の依頼書が出ない', !rows.some((r) => r[5] === 100), JSON.stringify(rows))
  } else if (mode === 'readopt') {
    const ranks = await ranksOf(X); log('ranks', JSON.stringify(ranks))
    await t.role('design'); await t.press('1')
    const nO = ranks.findIndex((r) => r[0] !== 'S1') + 1
    const a1 = await h.adoptPick(X, nO, '6', '別の商社で'); p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('adopt other →', a1.toast, h.show(p, X))
    if (rX.flags.pmPending) { await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(X, 'ok')).toast); await t.role('design'); await t.press('1') }
    const ranks2 = await ranksOf(X); const nS1 = ranks2.findIndex((r) => r[0] === 'S1') + 1
    const a2 = await h.adoptPick(X, nS1, '6', '因幡に戻す'); p = await t.proj(); rX = p.rows.find((r) => r.id === X)
    log('adopt S1 again →', a2.toast, h.show(p, X), 'case', await h.caseOf(X), iss(p, X))
    if (rX.flags.pmPending) log('INFO 例外選定で PM へ', rX.flags.pmReason)
    check('L1R-1 却下のあと因幡に選び直しても、発注数が黙って却下した余剰（100）にならない', rX.adoptedSupplierId !== 'S1' || rX.orderQty !== 100 || !!rX.flags.pmPending || /却下/.test(a2.toast), `${h.show(p, X)} toast=${a2.toast}`)
    if (rX.flags.pmPending) { await t.role('pm'); await t.press('7'); log('PM y (例外選定) →', (await t.yes(X, 'ok')).toast); p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after', h.show(p, X)) }
    await t.role('purchasing'); const { fm, rows } = await formalRows(X); log('formal →', fm, JSON.stringify(rows))
    log('INFO L1R-2 PM が例外選定を承認したあと、因幡 100 で正式見積の依頼書が出る（PM は例外選定として見た）', rows.some((r) => r[0] === '因幡電機' && r[5] === 100), JSON.stringify(rows), 'surplusRejected', rX.flags.surplusRejected ?? '-')
  }
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l1-' + mode)
summary(); await t.close()
