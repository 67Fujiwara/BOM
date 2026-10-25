// o8: 承認 ON。正式依頼中の行 X・Y の必要数を変更セットで変える → 承認待ちの間の再依頼 → PM が X 承認・Y 却下 → 再発行と差分シート
//   期待: 承認待ちの行は再発行の依頼書に出ない（除外と表示）。承認で X は「取下げ・再発行対象」＋必要数の再見積要。Y（却下）は何も起きない。
//         再発行の依頼書は X だけ（Rev F2）、「差分」シートに X の必要数 旧→新。Y は載らない。購買は承認待ちの間に変更を見ない（9/8 の再発行に出ない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
await t.open('design'); log('publish drafts →', (await t.publish('1')).slice(0, 60))
await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(0, 120))
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 3)
const X = fr[0].id, Y = fr.find((r) => r.id !== X).id
const qX = rowOf(p, X).qtyNeeded, qY = rowOf(p, Y).qtyNeeded, sid = rowOf(p, X).adoptedSupplierId
const mode = process.argv[2] ?? 'appr'
log('X', X, 'qty', qX, 'Y', Y, 'qty', qY, 'supplier', sid, 'mode', mode)
await t.role('design'); await t.press('1'); log('X qty →', (await t.setCellKey(X, 'qtyNeeded', String(qX + 2))).slice(0, 40)); log('publish Rev.c →', (await t.publish('1')).slice(0, 80))
p = await t.proj(); checkInv('O8-0', p); log('X', h.show(p, X).slice(0, 160))
check('O8-1 承認待ちの間、X は正式依頼中のまま（再発行対象にならない）。購買の 8 の再発行にも出ない', rowOf(p, X).status === 'formalRequested' && !rowOf(p, X).flags.reissue, h.show(p, X).slice(0, 160))
await t.role('purchasing'); const n0 = t.downloads.length; const m1 = await t.requestFormal(); await page.waitForTimeout(1200)
check('O8-2 承認待ちの間の正式依頼に X を出さない', !(await h.files(n0)).some((f) => f.ids.includes(X)), m1.slice(0, 160))
await t.role('pm'); await t.press('7')
if (mode === 'rej') {
  log('PM Shift+Y X →', (await t.decide(X, 'Shift+Y', '不可')).toast.slice(0, 70)); p = await t.proj(); checkInv('O8-3', p); const rX = rowOf(p, X)
  check('O8-3 却下で X は元の必要数・正式依頼中のまま・再発行対象にならず、設計の作業中に新しい必要数', rX.qtyNeeded === qX && rX.status === 'formalRequested' && !rX.flags.reissue && !rX.flags.requote && rX.working?.qtyNeeded === qX + 2, h.show(p, X).slice(0, 160) + ' w=' + JSON.stringify(rX.working ?? null))
  const n1 = t.downloads.length; await t.role('purchasing'); const m2 = await t.requestFormal(); await page.waitForTimeout(1200)
  check('O8-4 却下後も、購買の正式依頼に X は出ない（再発行する理由がない）', !(await h.files(n1)).some((f) => f.ids.includes(X)), m2.slice(0, 160))
  log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close(); process.exit(0)
}
log('PM y X →', (await t.yes(X, 'X 承認')).toast.slice(0, 70))
p = await t.proj(); checkInv('O8-3', p); log('X', h.show(p, X).slice(0, 200))
let rX = rowOf(p, X)
check('O8-3 承認で X は必要数が公開値、取下げ・再発行対象＋再見積要（正式依頼中以降の数量変更）', rX.qtyNeeded === qX + 2 && rX.flags.reissue === true && rX.flags.requote === true, h.show(p, X).slice(0, 160))
await t.role('purchasing'); await t.press('9'); const in9X = (await t.viewRows()).includes(X); log('purchasing 9 has X', in9X, 'ball', await h.ballOf(X))
const n1 = t.downloads.length; const m2 = await t.requestFormal(); await page.waitForTimeout(1200); log('formal (requote 中) →', m2.slice(0, 200))
check('O8-4 再見積要の X は正式依頼に出ない（概算を取り直してから）', !(await h.files(n1)).some((f) => f.ids.includes(X)), m2.slice(0, 200))
// 概算を取り直す → 回答 → 採用 → 正式の再発行
const n2 = t.downloads.length; const rq = await h.requestTo(null); await page.waitForTimeout(1500); const rf = await h.files(n2); log('rough re-request', rq.msg.slice(0, 120), JSON.stringify(rf.map((f) => [f.sup, f.ids.length, f.ids.includes(X)])))
check('O8-5 概算の取り直しは X を含み、変えていない Y を含まない', rf.some((f) => f.ids.includes(X)) && !rf.some((f) => f.ids.includes(Y)), JSON.stringify(rf.map((f) => [f.sup, f.ids.includes(X), f.ids.includes(Y)])))
p = await t.proj(); log('X', h.show(p, X).slice(0, 220))
await t.press('6'); for (const [s2, pr, ld] of [['S1', 43500, 18], ['S2', 52000, 5], ['S3', 44200, 22]]) await h.q(X, s2, pr, ld); await t.press('Escape')
p = await t.proj(); log('X after answers', h.show(p, X).slice(0, 200))
await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(150)
p = await t.proj(); rX = rowOf(p, X); log('X after a', h.show(p, X).slice(0, 200), await t.toast())
await t.role('purchasing'); const n3 = t.downloads.length; const m3 = await t.requestFormal(); await page.waitForTimeout(1800); log('formal reissue →', m3.slice(0, 200))
const dls = t.downloads.slice(n3); const infos = []
for (const dl of dls) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let no = ''; const ids = []; sh.eachRow((r) => { const v = r.values.slice(1); if (v[0] === '依頼No') no = v[1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); const d = wb.getWorksheet('差分'); const rows = []; if (d) d.eachRow((r) => rows.push(r.values.slice(1).map(String))); infos.push({ no, ids, rows }) }
log('reissue files', JSON.stringify(infos).slice(0, 700))
const mine = infos.filter((i) => i.ids.includes(X))
check('O8-6 再発行の依頼書に X が出る。Rev F2 以降。Y（変えていない）は出ない', mine.length >= 1 && mine.every((i) => /-F[2-9]$/.test(String(i.no))) && !infos.some((i) => i.ids.includes(Y)), JSON.stringify(infos.map((i) => [i.no, i.ids.includes(X), i.ids.includes(Y)])))
check('O8-7 差分シートに X の必要数 旧→新（' + qX + ' → ' + (qX + 2) + '）', mine.some((i) => i.rows.some((r) => r[0] === X && /必要数|qtyNeeded/.test(r[1]) && r[2] === String(qX) && r[3] === String(qX + 2))), JSON.stringify(mine.map((i) => i.rows)).slice(0, 400))
check('O8-7b 商社に渡す差分シートの「項目」が日本語（必要数）で、内部の項目名（qtyNeeded）にならない', mine.some((i) => i.rows.some((r) => r[0] === X && r[1] === '必要数')), JSON.stringify(mine.map((i) => i.rows)).slice(0, 300))
check('O8-8 差分シートに X 以外の行（Y など）が載らない', mine.every((i) => i.rows.filter((r) => /^R\d+$/.test(r[0]) && r[0] !== X).length === 0), JSON.stringify(mine.map((i) => i.rows)).slice(0, 300))
p = await t.proj(); log('X after reissue', h.show(p, X).slice(0, 220)); checkInv('O8-9', p)
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
