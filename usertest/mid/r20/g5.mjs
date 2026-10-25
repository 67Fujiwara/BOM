// g5: 承認待ち・却下の変更セットの中身が、購買の出力・商社向けの差分に漏れないか（M13-02 の修正の周り）
//   mode=fixrev: 承認待ちの型式変更がある行で、別に指摘対応（即時の Rev）を公開 → 購買の社内・保管用 Excel の変更点
//   mode=reject: 却下した数量変更のあと、案件納期の変更で再発行 → 商社向けの正式見積依頼書の差分シート
//   mode=due   : 承認待ちの変更セットが最後の Rev のときに案件納期を変える → 起因「案件納期変更」の行の行方（購買の変更点・却下後の 5）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'fixrev'
const t = await launch(); const { page } = t; const h = helpers(t)
async function excel(idx, re) {
  const n0 = t.downloads.length
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120)
  for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const dl = t.downloads[n0]; if (!dl) return ['no download']
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const found = []
  wb.eachSheet((sh) => sh.eachRow((r) => { const txt = JSON.stringify(r.values); if (re.test(txt)) found.push(sh.name + ': ' + txt.slice(0, 200)) }))
  return found
}
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
if (mode === 'fixrev') {
  await t.role('design'); await t.press('1'); log('R011 model →', await t.setCellKey('R011', 'model', 'PEND-777')); log('publish →', await t.publish('1'))
  await t.role('purchasing'); await t.press('1'); await t.goto('R011'); await t.colKey('qtyNeeded'); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('q'); await page.waitForTimeout(60)
  await page.getByTestId('issue-text').fill('必要数 24 で合っていますか'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80)
  log('issue publish →', await t.publish())
  let p = await t.proj(); log('issues', JSON.stringify(p.issues.filter((i) => i.rowId === 'R011').map((i) => [i.id, i.kind, i.field, i.status])))
  await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === 'R011').qtyNeeded
  log('R011 qty →', await t.setCellKey('R011', 'qtyNeeded', String(q0 * 2))); log('publish fix →', await t.publish('1'))
  p = await t.proj(); log('subs', JSON.stringify(p.submissions.slice(-3).map((s) => [s.rev, s.rowIds, s.changeSet ? { a: s.changeSet.approved, r: s.changeSet.rejected } : null, s.snapshot.R011?.model, s.snapshot.R011?.qtyNeeded])))
  log('R011', h.show(p, 'R011'), 'model', p.rows.find((r) => r.id === 'R011').model, 'pending', JSON.stringify(p.rows.find((r) => r.id === 'R011').pendingApproval))
  await t.role('purchasing'); await t.press('1'); log('purch grid R011 model', await t.cellText('R011', 'model'), 'qty', await t.cellText('R011', 'qtyNeeded'))
  await t.press('5'); log('purch 5 has R011', (await t.viewRows()).includes('R011'), 'cause', await t.cellText('R011', 'cause'), 'model', await t.cellText('R011', 'model'))
  const ex1 = await excel(0, /PEND-777/), ex3 = await excel(2, /PEND-777/)
  log('purch excel 社内', JSON.stringify(ex1)); log('purch excel 保管用', JSON.stringify(ex3))
  check('G5-1 承認待ちの型式変更（PEND-777）は、同じ行の指摘対応の Rev を公開しても購買の社内・保管用 Excel に出ない', !ex1.length && !ex3.length, JSON.stringify([...ex1, ...ex3]).slice(0, 400))
} else if (mode === 'reject') {
  await t.role('design'); log('bulk →', await t.bulk())
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  let p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed)
  const Y = fr[1].id; const q0 = fr[1].qtyNeeded
  const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === fr[1].adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
  await t.role('design'); await t.press('1'); await t.setCellKey(Y, 'qtyNeeded', String(q0 * 5)); log('publish qty x5 →', await t.publish('2'))
  await t.role('pm'); await t.press('7'); await t.goto(Y); await t.press('Shift+Y'); await page.waitForTimeout(80); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('数量増は認めない'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } if (await t.panel()) await page.keyboard.press('Escape') }
  log('PM reject →', await t.toast())
  await t.role('design'); await t.press('1'); log('revert qty →', await t.setCellKey(Y, 'qtyNeeded', String(q0)))
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y', h.show(p, Y), 'qty', rY.qtyNeeded, 'working', JSON.stringify(rY.working), '|', await h.status(Y))
  log('subs', JSON.stringify(p.submissions.slice(-2).map((s) => [s.rev, s.rowIds.slice(0, 5), s.revoked ?? false, s.snapshot[Y]?.qtyNeeded])))
  await t.role('pm'); const due0 = p.dueDate; const due1 = new Date(new Date(due0).getTime() - 3 * 86400000).toISOString().slice(0, 10)
  log('PM dueDate →', await h.setting('dueDate', due1, '前倒し'))
  p = await t.proj(); log('Y after due', h.show(p, Y), '|', await h.status(Y))
  await t.role('purchasing'); const n1 = t.downloads.length; log('formal reissue →', await t.requestFormal())
  const rows = []
  for (const dl of t.downloads.slice(n1)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const d = wb.getWorksheet('差分'); const main = wb.worksheets[0]; let sup = ''; main.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0) sup = v[j + 1] }); if (d) d.eachRow((r) => { const v = r.values.slice(1); if (v[0] === Y) rows.push([sup, ...v]) }); main.eachRow((r) => { const v = r.values.slice(1); if (v[0] === Y) rows.push(['main', ...v.slice(0, 7)]) }) }
  log('Y in formal docs', JSON.stringify(rows))
  check('G5-2 PM が却下した数量変更（×5）は、商社向けの正式見積依頼書の差分シートに出ない（変わったのは必要納期だけ）', !rows.some((r) => r[2] === 'qtyNeeded'), JSON.stringify(rows))
} else {
  await t.role('design'); await t.press('1'); log('R011 model →', await t.setCellKey('R011', 'model', 'PEND-777')); log('publish →', await t.publish('1'))
  let p = await t.proj(); const last = p.submissions.at(-1); log('last sub', last.rev, JSON.stringify(last.changeSet))
  await t.role('pm'); const due1 = new Date(new Date(p.dueDate).getTime() - 3 * 86400000).toISOString().slice(0, 10)
  log('PM dueDate →', await h.setting('dueDate', due1, '前倒し'))
  p = await t.proj(); const subs = p.submissions.map((s) => [s.rev, s.changeSet ? (s.changeSet.approved ? 'cs-approved' : 'cs-pending') : 'plain', s.rowIds.length, Object.values(s.causes).filter((c) => c === '案件納期変更').length])
  log('subs', JSON.stringify(subs))
  const dueRows = p.rows.filter((r) => p.submissions.some((s) => s.causes[r.id] === '案件納期変更')).map((r) => r.id)
  log('案件納期変更 rows', dueRows.length, dueRows.slice(0, 5).join(','))
  await t.role('purchasing'); await t.press('5'); const v5p = await t.viewRows(); log('purch 5 count', v5p.length, 'cause R001', await t.cellText('R001', 'cause'))
  const exP = await excel(0, /案件納期変更/); log('purch 社内 変更点 案件納期変更 rows', exP.length)
  check('G5-3 案件納期の変更（起因「案件納期変更」）は、承認待ちの変更セットが最後の Rev でも購買の変更点に出る', exP.length > 0, `excel rows=${exP.length}`)
  await t.role('pm'); await t.press('7'); await t.goto('R011'); await t.press('Shift+Y'); await page.waitForTimeout(80); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('型式変更は不可'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } if (await t.panel()) await page.keyboard.press('Escape') }
  log('PM reject R011 →', await t.toast())
  await t.role('design'); await t.press('5'); const v5d = await t.viewRows(); log('design 5 count', v5d.length, 'has R001', v5d.includes('R001'), 'cause R001', await t.cellText('R001', 'cause'))
  const cD = await t.cellText(dueRows[0], 'cause')
  await t.role('purchasing'); await t.press('5'); const v5p2 = await t.viewRows(); const cP = await t.cellText(dueRows[0], 'cause'); log('purch 5 count after reject', v5p2.length, 'cause', cP)
  check('G5-4 変更セットを却下しても、案件納期の変更の行は設計・購買の 5 に起因「案件納期変更」で残る（§9.3）', /案件納期変更/.test(cD) && /案件納期変更/.test(cP), `design cause=${cD} purch cause=${cP}`)
}
summary(); await t.close()
