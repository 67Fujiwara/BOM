// j7: 承認待ちの変更セットのあとに同じ行の Rev（M15-07 の修正: 承認のとき後の Rev のスナップショットを承認値に直す）の境界
//   mode=samefield: 変更セット（部品名 → NAME-CS、承認待ち）→ 購買が部品名に質問 → 設計が部品名を NAME-FIX にして公開（指摘対応）→ PM 承認
//                   期待: 行の部品名は後で決めた NAME-FIX（承認で古い変更セットの値に戻さない）、変更点・差分が今の値と合う
//   mode=reject   : 変更セット（必要数 ×3、承認待ち）→ 同じ行の指摘対応の Rev（部品名）→ PM 却下 → 購買の変更点・再発行の差分に必要数が出ない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'samefield'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel(idx) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); return sheetsOf(n0) }
const subsOf = (p, id) => JSON.stringify(p.submissions.filter((s) => s.rowIds.includes(id)).map((s) => [s.rev, s.changeSet ? (s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : 'pend') : 'plain', s.snapshot[id]?.qtyNeeded, s.snapshot[id]?.name, s.causes[id]]))
async function question(id, col, text) {
  await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.colKey(col); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('q'); await page.waitForTimeout(60)
  await page.getByTestId('issue-text').fill(text); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80); return t.publish()
}
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[1].id, ad = fr[1].adoptedSupplierId, q0 = fr[1].qtyNeeded, name0 = fr[1].name
{ const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === ad && !x.stale); await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
if (mode === 'samefield') {
  await t.role('design'); await t.press('1'); log('Y name (cs) →', await t.setCellKey(Y, 'name', 'NAME-CS')); log('publish cs →', await t.publish('1'))
  p = await t.proj(); log('Y pending', h.show(p, Y), 'name', p.rows.find((r) => r.id === Y).name, 'pending', JSON.stringify(p.rows.find((r) => r.id === Y).pendingApproval))
  log('question →', await question(Y, 'name', '部品名は社内標準名で'))
  await t.role('design'); await t.press('1'); log('Y name (fix) →', await t.setCellKey(Y, 'name', 'NAME-FIX')); log('publish fix →', await t.publish('1'))
  p = await t.proj(); const rY0 = p.rows.find((r) => r.id === Y); log('Y before approve', 'name', rY0.name, 'pending', JSON.stringify(rY0.pendingApproval), 'subs', subsOf(p, Y))
  await t.role('pm'); await t.press('7'); const y = await t.yes(Y, '名称変更を承認'); log('PM y →', y.toast)
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y after approve', h.show(p, Y), 'name', rY.name, '|', await h.status(Y), 'subs', subsOf(p, Y))
  check('J7-1 承認待ちの変更セットのあとで指摘対応で同じ列（部品名）を直した行は、PM の承認で古い変更セットの値（NAME-CS）に戻らない（NAME-FIX のまま、または承認の前に知らせる）', rY.name === 'NAME-FIX' || /NAME-FIX|あとの Rev|後の Rev/.test(y.toast + JSON.stringify(y.prompt ?? '')), `name=${rY.name} toast=${y.toast}`)
  await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === Y)
  log('purch 変更点 Y', JSON.stringify(chg))
  const bom = ex.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows).find((r) => r[0] === Y); log('purch BOM Y name', bom?.[4])
  check('J7-2 購買の社内 Excel の BOM の部品名と、変更点の最後の値が食い違わない', (() => { const last = [...chg].reverse().find((r) => /部品名: .* → /.test(String(r[7]))); const m = last ? String(last[7]).match(/部品名: .* → ([^/]*)/) : null; return !m || m[1].trim() === String(bom?.[4]) })(), JSON.stringify({ chg, bomName: bom?.[4] }))
} else {
  await t.role('design'); await t.press('1'); log('Y qty (cs) →', await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3))); log('publish cs →', await t.publish('1'))
  log('question →', await question(Y, 'name', '部品名は正式名称で'))
  await t.role('design'); await t.press('1'); log('Y name (fix) →', await t.setCellKey(Y, 'name', name0 + '（正式名）')); log('publish fix →', await t.publish('1'))
  p = await t.proj(); log('subs before reject', subsOf(p, Y))
  await t.role('pm'); await t.press('7'); const dec = await t.decide(Y, 'Shift+Y', '数量の変更は客先未確定'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y after reject', h.show(p, Y), 'qty', rY.qtyNeeded, 'name', rY.name, 'working', JSON.stringify(rY.working ?? null), '|', await h.status(Y), 'subs', subsOf(p, Y))
  await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === Y)
  log('purch 変更点 Y', JSON.stringify(chg))
  check('J7-3 却下した変更セットの必要数が購買の変更点に出ない', !chg.some((r) => /必要数/.test(String(r[7]))), JSON.stringify(chg))
  p = await t.proj(); const n0 = t.downloads.length; const fm = await t.requestFormal(); const sh = await sheetsOf(n0)
  const diff = sh.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y)
  log('formal →', fm, 'diff Y', JSON.stringify(diff), 'reissue?', p.rows.find((r) => r.id === Y).flags.reissue)
  check('J7-4 却下のあとの再発行（があれば）の差分シートに必要数が出ない', !diff.some((r) => r[1] === '必要数'), JSON.stringify(diff))
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j7-' + mode)
summary(); await t.close()
