// k9: 再見積を 2 回はさんで、正式依頼の商社が ad → O → ad と移る（M16-06 の修正: 前回送った内容を再見積の見積に引き継ぐ）
//   ad に F1（必要数 q0）→ 必要数 ×3・再見積 → O で採用 → O に正式依頼 → 必要数 ×4・再見積 → ad で採用 → ad に正式依頼
//   期待: ad 宛の差分シートは ad に前回送った内容（q0）と比べる（q0 → ×4）。取下げは O の分が残り ad の分は外れる
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && ['S1', 'S2'].includes(r.adoptedSupplierId) && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.needOffset == null && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[2].id, ad = fr[2].adoptedSupplierId, q0 = fr[2].qtyNeeded; const O = ad === 'S1' ? 'S2' : 'S1'
log('Y', h.show(p, Y), 'ad', ad, 'O', O)
async function round(qty, winner) {
  await t.role('design'); await t.press('1'); log('Y qty →', qty, await t.setCellKey(Y, 'qtyNeeded', String(qty))); log('publish →', await t.publish('2'))
  await t.role('purchasing'); const r1 = await h.requestTo(null); log('requote →', r1.msg, JSON.stringify(r1.f.map((f) => [f.sup, f.ids.includes(Y)])))
  await t.press('6'); for (const sid of ['S1', 'S2', 'S3']) await h.q(Y, sid, sid === winner ? 100 : 300, 1); await t.press('Escape')
  await t.role('design'); await t.press('1'); await t.goto(Y); await t.press('a'); await page.waitForTimeout(80); log('a →', await t.toast())
  await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); const sh = await sheetsOf(n0)
  const fY = new Set(sh.filter((s) => s.rows.some((r) => r[0] === Y)).map((s) => s.f)); const mine = sh.filter((s) => fY.has(s.f))
  p = await t.proj(); log('formal →', fm, 'files', JSON.stringify(mine.map((s) => [s.f, s.sh])), '|', h.show(p, Y), 'wd', p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? '-')
  return { mine, diff: mine.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y), head: mine.filter((s) => s.sh !== '差分').flatMap((s) => s.rows).slice(0, 6) }
}
const a = await round(q0 * 3, O)
log('to O: header', JSON.stringify(a.head), 'diff', JSON.stringify(a.diff))
p = await t.proj(); const wdA = p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? ''
check('K9-1 O に出した時点で、ad への取下げ（まだ伝えていない）が残る', wdA.includes(NAMES[ad]), wdA)
const b = await round(q0 * 4, ad)
log('to ad: header', JSON.stringify(b.head), 'diff', JSON.stringify(b.diff))
check('K9-2 ad 宛の再発行の差分シートは、ad に前回送った必要数（' + q0 + '）と比べる（' + q0 + ' → ' + q0 * 4 + '）', b.diff.some((r) => r[1] === 'qtyNeeded' && String(r[2]) === String(q0) && String(r[3]) === String(q0 * 4)), JSON.stringify(b.diff))
p = await t.proj(); const wdB = p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? ''
check('K9-3 ad に出し直したら ad の取下げは外れ、O への取下げは残る', !wdB.includes(NAMES[ad]) && wdB.includes(NAMES[O]), wdB)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k9')
summary(); await t.close()
