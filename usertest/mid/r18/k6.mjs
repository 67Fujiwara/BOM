// k6: 承認待ちの変更セットと、同じ行の指摘対応の Rev（M16-05 の修正: 後から公開した列は承認待ちの値から外す）の先
//   mode=reject : 変更セット（部品名 NAME-CS）承認待ち → 指摘対応で部品名 NAME-FIX → PM 却下 → NAME-FIX のまま、作業中に NAME-CS が戻らない
//   mode=two    : 変更セット（部品名 NAME-CS ＋ 必要数 ×3）承認待ち → 指摘対応で部品名 NAME-FIX → PM 承認 → 部品名 NAME-FIX・必要数 ×3
//   mode=empty  : 変更セット（部品名だけ）→ 指摘対応で同じ部品名 → PM の 7 に中身の無い変更セットが残るか・承認で何が起きるか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'reject'
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
const Y = fr[2].id, q0 = fr[2].qtyNeeded, name0 = fr[2].name
log('Y', h.show(p, Y), 'name0', name0)
await t.role('design'); await t.press('1'); log('Y name (cs) →', await t.setCellKey(Y, 'name', 'NAME-CS'))
if (mode === 'two') log('Y qty (cs) →', await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3)))
log('publish cs →', await t.publish('1'))
p = await t.proj(); log('Y pending', JSON.stringify(p.rows.find((r) => r.id === Y).pendingApproval), 'subs', subsOf(p, Y))
log('question →', await question(Y, 'name', '部品名は社内標準名で'))
await t.role('design'); await t.press('1'); log('Y name (fix) →', await t.setCellKey(Y, 'name', mode === 'empty' ? 'NAME-FIX' : 'NAME-FIX')); log('publish fix →', await t.publish('1'))
p = await t.proj(); const rY0 = p.rows.find((r) => r.id === Y)
log('Y before PM', 'name', rY0.name, 'qty', rY0.qtyNeeded, 'pending', JSON.stringify(rY0.pendingApproval ?? null), 'pmPending', rY0.flags.pmPending, 'subs', subsOf(p, Y))
await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(Y)
await t.press('1'); await t.goto(Y); await t.press('Home'); await t.press('7'); const sbPm = (await t.status()).slice(0, 260)
log('PM 7 has Y', in7, 'case', await h.caseOf(Y), 'statusbar', sbPm)
if (mode === 'reject') {
  const dec = await t.decide(Y, 'Shift+Y', '客先未確定'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y)
  log('Y after reject', h.show(p, Y), 'name', rY.name, 'working', JSON.stringify(rY.working ?? null), '|', await h.status(Y), 'subs', subsOf(p, Y))
  check('K6-1 却下のあとも部品名は後で直した NAME-FIX（公開値）', rY.name === 'NAME-FIX', rY.name)
  check('K6-2 却下で設計の作業中に古い NAME-CS が戻らない（後の指摘対応で上書きした列）', !(rY.working && rY.working.name === 'NAME-CS'), JSON.stringify(rY.working ?? null))
} else if (mode === 'two') {
  const y = await t.yes(Y, '承認'); log('PM y →', y.toast)
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y)
  log('Y after approve', h.show(p, Y), 'name', rY.name, 'qty', rY.qtyNeeded, '|', await h.status(Y), 'subs', subsOf(p, Y))
  check('K6-3 承認で部品名は NAME-FIX のまま、必要数は変更セットの ×3', rY.name === 'NAME-FIX' && rY.qtyNeeded === q0 * 3, `name=${rY.name} qty=${rY.qtyNeeded}`)
  check('K6-4 承認した必要数の変更で取下げ・再発行対象（正式依頼中の行の数量変更）', !!rY.flags.reissue || !!rY.flags.requote, JSON.stringify(rY.flags))
  await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === Y)
  log('purch 変更点 Y', JSON.stringify(chg))
  const bom = ex.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows).find((r) => r[0] === Y); log('BOM Y', JSON.stringify(bom?.slice(0, 8)))
  check('K6-5 変更点に NAME-CS → NAME-FIX（指摘対応の Rev）と必要数の変更（変更セット）が出る', chg.some((r) => /NAME-FIX/.test(String(r[7]))) && chg.some((r) => /qtyNeeded/.test(String(r[7]))), JSON.stringify(chg.map((r) => [r[0], r[4], r[7]])))
} else {
  log('INFO empty: PM の 7 に中身の無い変更セットの行', in7, 'pending', JSON.stringify(rY0.pendingApproval ?? null))
  check('K6-6 後の指摘対応で中身が無くなった変更セットの行が、PM の 7 に「承認待ち」のまま残らない（または中身が無いと分かる）', !in7 || /変更なし|中身|後の Rev|指摘対応で/.test(sbPm), `in7=${in7} sb=${sbPm}`)
  const y = await t.yes(Y, '承認'); log('PM y →', y.toast)
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y after approve', h.show(p, Y), 'name', rY.name, '|', await h.status(Y), 'subs', subsOf(p, Y))
  check('K6-7 承認しても NAME-FIX のまま', rY.name === 'NAME-FIX', rY.name)
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k6-' + mode)
summary(); await t.close()
