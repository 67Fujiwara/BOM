// g7: まだ通していない流れ
//   mode=record: 入荷記録 → 商社の実績（納期遵守率）の自動集計（§8.1 実績 20）
//   mode=minlot: 最小ロットの指摘で余剰金額が閾値を大きく超える → PM の要決定（§6.2 A=PM・§9.1「最小ロット・廃番の閾値超」）
//   mode=ltb   : 購買の「先行発注を申請」→ PM の y → 発注 → 役割ごとの Excel（社内）の状態
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'record'
const t = await launch(); const { page } = t; const h = helpers(t)
const scores = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => [x.supplierId, x.total, x.record, x.reasons.join('・')]) }, id)
if (mode === 'record') {
  await t.open('design'); log('bulk →', await t.bulk())
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  let p = await t.proj(); const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'formalRequested').map((r) => r.id).slice(0, 3)
  const other = p.rows.find((r) => r.status === 'formalRequested' && r.adoptedSupplierId !== 'S3' && p.quotes.some((q) => q.rowId === r.id && q.supplierId === 'S3' && !q.stale && q.unitPrice != null)).id
  log('S3 rows', s3.join(','), 'other row with S3 quote', other, JSON.stringify(await scores(other)))
  await t.press('8'); for (const id of s3) { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === 'S3' && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
  await t.press('Escape'); for (const id of s3) log('order', id, await t.order(id))
  await t.press('3'); for (const id of s3) { await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(80); log('receive', id, await t.toast()) }
  p = await t.proj(); log('statuses', s3.map((id) => p.rows.find((r) => r.id === id).status).join(','))
  const sup = (await t.ws()).suppliers.find((s) => s.id === 'S3'); log('S3 master', JSON.stringify(sup))
  const sc = await scores(other); log('other scores after receipts', JSON.stringify(sc))
  check('G7-1 入荷記録（S3 で 3 行入荷）から S3 の実績（納期遵守率）が集計され、「実績なし」（実績点 50）でなくなる（§8.1）', sup.onTimeRate != null || !sc.find((x) => x[0] === 'S3')?.[3].includes('実績なし'), `onTimeRate=${sup.onTimeRate} ${JSON.stringify(sc.find((x) => x[0] === 'S3'))}`)
} else if (mode === 'minlot') {
  await t.open('design'); log('bulk →', await t.bulk())
  let p = await t.proj()
  const X = p.rows.find((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded <= 4 && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0) > 2000).id
  const qX = p.quotes.find((q) => q.rowId === X && q.supplierId === 'S1' && !q.stale)
  log('X', h.show(p, X), 'qty', p.rows.find((r) => r.id === X).qtyNeeded)
  await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  log('raise →', await t.toast()); log('publish →', await t.publish())
  p = await t.proj(); const iss = p.issues.filter((i) => i.rowId === X); log('issues', JSON.stringify(iss.map((i) => [i.id, i.kind, i.text, i.status])))
  log('X', h.show(p, X), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
  await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('PM 7 has X', in7)
  check('G7-2 最小ロットの余剰金額（MOQ 100 で約 ¥' + Math.round((100 - p.rows.find((r) => r.id === X).qtyNeeded) * qX.unitPrice).toLocaleString() + '）が閾値を大きく超えたら PM の要決定（7）に載る（§6.2 A=PM、§9.1）', in7, `in7=${in7} ball=${await h.ballOf(X)} case=${await h.caseOf(X)}`)
} else {
  await t.open('design')
  let p = await t.proj(); const L = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3).id
  log('L', h.show(p, L), '|', await h.status(L))
  await t.role('purchasing'); await t.press('1'); await t.goto(L); await t.cmd('先行発注を申請'); await page.waitForTimeout(80); const pr = await t.panel(); log('ltb prompt', pr?.title, JSON.stringify(pr?.extra))
  if (pr?.kind === 'prompt') { await t.promptFill('長納期のため'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
  log('ltb →', await t.toast()); p = await t.proj(); log('L', h.show(p, L), 'ball', await h.ballOf(L), 'case', await h.caseOf(L))
  await t.role('pm'); await t.press('7'); log('PM 7 has L', (await t.viewRows()).includes(L)); const y = await t.yes(L, '先行発注を許可'); log('PM y →', y.toast)
  p = await t.proj(); log('L after y', h.show(p, L), '|', await h.status(L), 'early', p.rows.find((r) => r.id === L).flags.early)
  await t.role('purchasing'); const o = await t.order(L); p = await t.proj(); const rL = p.rows.find((r) => r.id === L); log('order →', o, '|', h.show(p, L), '|', await h.status(L))
  check('G7-3 先行発注の申請 → PM の y → 推奨商社で選定済（先行）→ 正式見積なしで発注できる（§4・§9.1）', rL.status === 'ordered' && rL.ordered && rL.adoptedSupplierId, h.show(p, L))
  // 役割ごとの社内 Excel に、先行発注の決定と状態が出るか
  const res = {}
  for (const role of ['design', 'purchasing', 'pm']) {
    await t.role(role); const n0 = t.downloads.length
    await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
    const dl = t.downloads[n0]; const found = []
    if (dl) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => sh.eachRow((r) => { const txt = JSON.stringify(r.values); if (txt.includes(`"${L}"`)) found.push(sh.name + ': ' + txt.slice(0, 220)) })) }
    res[role] = found; log(role, 'excel', JSON.stringify(found))
  }
  check('G7-4 3 役割の社内 Excel に、先行発注の行が「発注済」で、変更点シートに「先行発注許可」の決定が出る', ['design', 'purchasing', 'pm'].every((r) => res[r].some((x) => /発注済/.test(x)) && res[r].some((x) => /先行発注許可/.test(x))), JSON.stringify(res).slice(0, 300))
}
summary(); await t.close()
