// j10: 一部の商社だけへの再見積（M15-10 の修正: 頼まない商社の前の回答も旧見積に）の続き
//   正式見積済の行の必要数を 3 倍 → 立花だけに再見積 → 立花の回答 → 状態 → 残りの商社へ「相見積先すべて」→ どの商社に出るか → 回答 → 見積済
//   → 元の商社（正式依頼を出していた）で採用 → 正式見積の再発行の差分シート
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[1].id, q0 = fr[1].qtyNeeded
{ const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === 'S1' && !x.stale); await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await t.role('design'); await t.press('1'); log('Y qty →', await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3))); log('publish →', await t.publish('2'))
await t.role('purchasing'); const r1 = await h.requestTo('S2'); log('requote S2 only →', r1.msg)
p = await t.proj(); log('Y after S2 request', h.show(p, Y), '|', await h.status(Y), 'withdrawn', p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? '-')
await t.press('6'); log('S2 answer', await h.q(Y, 'S2', 380, 3)); await t.press('Escape')
p = await t.proj(); const s1 = await h.status(Y); log('Y after S2 answer', h.show(p, Y), '|', s1, 'ball', await h.ballOf(Y))
check('J10-1 1 社だけの回答では見積済にならず、残りの商社を待つ（見積中 1/3 など）', p.rows.find((r) => r.id === Y).status === 'quoting', s1)
await t.press('9'); const in9 = (await t.viewRows()).includes(Y); log('purch 9 has Y', in9)
const r2 = await h.requestTo(null); log('request all →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(Y)])))
const sentTo = r2.f.filter((f) => f.ids.includes(Y)).map((f) => f.sup)
check('J10-2 「相見積先すべて」で、まだ新しい数量で頼んでいない因幡・ミスミにだけ依頼する（回答済の立花に出し直さない）', sentTo.includes('因幡電機') && sentTo.includes('ミスミ') && !sentTo.includes('立花エレテック'), JSON.stringify(sentTo))
await t.press('6'); log('S1 answer', await h.q(Y, 'S1', 350, 3)); log('S3 answer', await h.q(Y, 'S3', 400, 3)); await t.press('Escape')
p = await t.proj(); const s2 = await h.status(Y); log('Y after all answers', h.show(p, Y), '|', s2, 'ball', await h.ballOf(Y))
check('J10-3 3 社の新しい回答で見積済、選定者のボール', p.rows.find((r) => r.id === Y).status === 'quoted' && (await h.ballOf(Y)) === 'design', `${s2} ball=${await h.ballOf(Y)}`)
await t.role('design'); await t.press('1'); const ap = await h.adoptPick(Y, 1); log('design Shift+A 1 →', ap.toast, JSON.stringify(ap.adoptPanel?.options?.slice(0, 3)))
p = await t.proj(); log('Y after adopt', h.show(p, Y), '|', await h.status(Y), 'withdrawn', p.rows.find((r) => r.id === Y).flags.formalWithdrawn ?? '-')
await t.role('purchasing'); const n0 = t.downloads.length; log('formal again →', await t.requestFormal()); const sh = await sheetsOf(n0)
const fY = new Set(sh.filter((s) => s.rows.some((r) => r[0] === Y)).map((s) => s.f)); const mine = sh.filter((s) => fY.has(s.f))
const diff = mine.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y); const main = mine.filter((s) => s.sh !== '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y)
p = await t.proj(); const rY = p.rows.find((r) => r.id === Y)
log('formal sheets', JSON.stringify(mine.map((s) => s.sh)), 'diff', JSON.stringify(diff), 'main', JSON.stringify(main)); log('Y after formal', h.show(p, Y), '|', await h.status(Y), 'withdrawn', rY.flags.formalWithdrawn ?? '-')
if (rY.adoptedSupplierId === 'S1') check('J10-4 再見積のあと元の因幡で採用し直した再発行（F2）の差分シートに必要数の変化（' + q0 + ' → ' + q0 * 3 + '）が出る（M15-08）', diff.some((r) => r[1] === '必要数' && String(r[2]) === String(q0)), `sheets=${JSON.stringify(mine.map((s) => s.sh))} diff=${JSON.stringify(diff)}`)
else log('INFO 採用は', rY.adoptedSupplierId)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j10')
summary(); await t.close()
