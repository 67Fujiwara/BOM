// n14: 承認 ON。調達区分の切り替えが変更セット（PM 承認待ち）のとき
//   mode=chain : Rev.c＝C を指定商社（立花）に切り替え・D の必要数 → Rev.d＝C の必要数 → Rev.d を承認 → Rev.c を承認 → C は S2 固定で採用・発注数は新しい必要数
//   mode=formal: C が正式依頼中。C を指定商社に切り替えて公開（承認待ち）→ 購買の見た目は元のまま（正式依頼中・因幡）、正式見積の依頼から除外 → 承認 → 取下げが記録され選定済（立花）→ 正式依頼に入る
//   mode=reject: 同じ形で却下 → C は元の相見積・正式依頼中のまま、切り替えは作業中に戻る
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'chain'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
let sel = await c.setup()
const rev = async () => (await t.proj()).submissions.at(-1).rev
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast); return y }
async function pmN(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.decide(id, 'Shift+Y', txt); log('PM Shift+Y', id, '→', y.toast); return y }
let p
if (mode !== 'chain') { await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj(); sel = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && r.adoptedSupplierId === 'S1' && p.quotes.some((q) => q.rowId === r.id && q.supplierId === 'S2' && !q.stale && q.unitPrice != null && q.leadDays !== -1)) }
const C = sel[0].id, D = sel[1]?.id ?? sel[0].id; const qC = sel[0].qtyNeeded
log('C', C, 'D', D, 'sid', sel[0].adoptedSupplierId)
await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated')
log('C proc →', await t.setCellKey(C, 'procurement', '指定商社')); log('C designated →', await t.setCellKey(C, 'designated', '立花エレテック'))
if (mode === 'chain') { const qD = sel[1].qtyNeeded; log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))) }
log('publish Rev.c →', await t.publish('1')); const revC = await rev(); p = await t.proj()
log('after Rev.c', c.subs(p), h.show(p, C), 'pa', JSON.stringify(rowOf(p, C).pendingApproval)); checkInv('N14-0', p)
if (mode === 'chain') {
  log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 3))); log('publish Rev.d →', await t.publish('1')); const revD = await rev(); p = await t.proj()
  log('after Rev.d', c.subs(p), JSON.stringify(rowOf(p, C).pendingApproval)); checkInv('N14-1', p)
  await pmY(C, 'Rev.d 承認'); p = await t.proj(); log('C', h.show(p, C))
  check('N14-2 Rev.d の承認で C は指定商社（立花）・必要数 ' + (qC + 3) + '（Rev.c の切り替えをまとめた）', rowOf(p, C).procurement === '指定商社' && rowOf(p, C).qtyNeeded === qC + 3 && rowOf(p, C).adoptedSupplierId === 'S2', h.show(p, C))
  check('N14-3 発注数は新しい必要数（立花の MOQ で丸めた数）', rowOf(p, C).orderQty >= qC + 3, String(rowOf(p, C).orderQty))
  checkInv('N14-3c', p)
  await pmY(D, 'Rev.c 承認'); p = await t.proj(); checkInv('N14-4c', p)
  check('N14-4 Rev.c の承認で D の必要数が公開値', rowOf(p, D).qtyNeeded === sel[1].qtyNeeded + 1, '')
  for (const role of ['design', 'purchasing', 'pm']) { const rows = await c.chg(role, C); log(role, '変更点 C', JSON.stringify(rows)); const r1 = revRow(rows, revC); check(`N14-X-${role} Rev.${revC} の C は「まとめた」`, r1 && /まとめた/.test(r1[3]), JSON.stringify(r1 ?? null)) }
} else {
  await t.role('purchasing'); p = await t.proj(); log('purchasing sees C', h.show(p, C))
  check('N14-1 承認待ちのあいだ、購買の公開値は元のまま（相見積・因幡・正式依頼中）', rowOf(p, C).procurement === '相見積' && rowOf(p, C).adoptedSupplierId === 'S1' && rowOf(p, C).status === 'formalRequested', h.show(p, C))
  const n0 = t.downloads.length; log('formal again →', await t.requestFormal())
  const ids = []; for (const dl of t.downloads.slice(n0)) { try { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }) } catch {} }
  log('formal request ids', ids.length, ids.includes(C))
  check('N14-2 承認待ちの C は正式見積の依頼書に出ない（承認待ちは自動除外）', !ids.includes(C), `ids=${ids.length}`)
  if (mode === 'formal') {
    await pmY(C, 'Rev.c 承認'); p = await t.proj(); log('C after approve', h.show(p, C), 'wd', rowOf(p, C).flags.formalWithdrawn)
    check('N14-3 承認で C は指定商社・立花で選定済、因幡への正式依頼の取下げが記録される', rowOf(p, C).procurement === '指定商社' && rowOf(p, C).adoptedSupplierId === 'S2' && !!rowOf(p, C).flags.formalWithdrawn, h.show(p, C))
    checkInv('N14-3c', p)
    await t.role('purchasing'); const n1 = t.downloads.length; log('formal →', await t.requestFormal())
    const ids2 = []; const sups = []; for (const dl of t.downloads.slice(n1)) { try { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); let sup = ''; wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (v[0] === C) { ids2.push(C); sups.push(sup) } }) } catch {} }
    log('C in formal →', JSON.stringify(sups))
    check('N14-4 承認後の正式見積の依頼書に C が立花宛で出る', sups.includes('立花エレテック'), JSON.stringify(sups))
  } else {
    await pmN(C, '切り替えは不可'); p = await t.proj(); log('C after reject', h.show(p, C), JSON.stringify(rowOf(p, C).working))
    check('N14-3 却下で C は元の相見積・因幡・正式依頼中のまま。切り替えは作業中に戻る', rowOf(p, C).procurement === '相見積' && rowOf(p, C).adoptedSupplierId === 'S1' && rowOf(p, C).status === 'formalRequested' && rowOf(p, C).working?.procurement === '指定商社', h.show(p, C) + ' w=' + JSON.stringify(rowOf(p, C).working))
    checkInv('N14-3c', p)
  }
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
