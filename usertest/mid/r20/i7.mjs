// i7: Rev のスナップショット・差分シート（M14-02 / M14-03 の修正の先）と案件納期の変更の起因（M14-04）
//   mode=approve: 承認待ちの変更セット（必要日の前倒し）→ 同じ行の指摘対応の Rev（部品名）→ PM が承認 → 購買の変更点・商社向けの差分シート
//   mode=multi  : 正式見積済の行の必要数を変更（Rev.2）→ 再見積・採用 → 備考だけ変更（Rev.3）→ 再発行の差分シート
//   mode=ack    : 設計・購買が 5 で確認済にした行のあとで、PM が案件納期を変える → 5 に「案件納期変更」で出るか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel(idx) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); return sheetsOf(n0) }
const subsOf = (p, id) => JSON.stringify(p.submissions.filter((s) => s.rowIds.includes(id)).map((s) => [s.rev, s.changeSet ? (s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : 'pend') : 'plain', s.snapshot[id]?.qtyNeeded, s.snapshot[id]?.needOffset, s.snapshot[id]?.name, s.causes[id]]))
if (mode === 'approve' || mode === 'multi') {
  await t.open('pm')
  if (mode === 'approve') log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
  await t.role('design'); log('bulk →', await t.bulk())
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  let p = await t.proj()
  const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.needOffset == null && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
  const Y = fr[1].id, ad = fr[1].adoptedSupplierId, q0 = fr[1].qtyNeeded, name0 = fr[1].name
  { const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === ad && !x.stale); await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
  p = await t.proj(); log('Y', h.show(p, Y), '|', await h.status(Y))
  if (mode === 'approve') {
    await t.role('design'); await t.press('1'); await t.showCol('needOffset'); log('Y needOffset →', await t.setCellKey(Y, 'needOffset', '-20')); log('publish (cs) →', await t.publish('1'))
    await t.role('purchasing'); await t.press('1'); await t.goto(Y); await t.colKey('name'); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('q'); await page.waitForTimeout(60)
    await page.getByTestId('issue-text').fill('部品名は正式名称で'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80); log('issue publish →', await t.publish())
    await t.role('design'); await t.press('1'); log('Y name →', await t.setCellKey(Y, 'name', name0 + '（正式名）')); log('publish fix →', await t.publish('1'))
    p = await t.proj(); log('subs before approve', subsOf(p, Y))
    await t.role('pm'); await t.press('7'); const y = await t.yes(Y, '前倒しを承認'); log('PM y →', y.toast)
    p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y after approve', h.show(p, Y), 'needOffset', rY.needOffset, 'name', rY.name, '|', await h.status(Y)); log('subs after approve', subsOf(p, Y))
    await t.role('purchasing'); const ex = await excel(0); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === Y)
    log('purch 社内 変更点 Y', JSON.stringify(chg))
    check('I7-1 承認のあと、購買の変更点の指摘対応の Rev が「必要日を元に戻した」ように見えない（needOffset: -20 → 空 が出ない）', !chg.some((r) => /needOffset: -20 →/.test(String(r[7]))), JSON.stringify(chg))
    await t.press('5'); log('purch 5 cause Y', await t.cellText(Y, 'cause'))
    const n0 = t.downloads.length; log('formal reissue →', await t.requestFormal()); const sh = await sheetsOf(n0)
    const diff = sh.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y); const main = sh.filter((s) => s.sh !== '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y)
    log('formal diff Y', JSON.stringify(diff)); log('formal main Y', JSON.stringify(main))
    check('I7-2 商社向けの再発行の差分シートで、承認した必要日の前倒しが「新 → 旧」の逆向きに出ない（needOffset -20 → 空 が出ない）', !diff.some((r) => r[1] === 'needOffset' && String(r[2]) === '-20'), JSON.stringify(diff))
  } else {
    await t.role('design'); await t.press('1'); log('Y qty →', await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3))); log('publish Rev2 →', await t.publish('2'))
    await t.role('purchasing'); const r1 = await h.requestTo(null); log('requote →', r1.msg)
    await t.press('6'); for (const sid of ['S1', 'S2', 'S3']) log('q', sid, await h.q(Y, sid, sid === ad ? 100 : 200, 1)); await t.press('Escape')
    await t.role('design'); await t.press('1'); await t.goto(Y); await t.press('a'); await page.waitForTimeout(80); log('a →', await t.toast())
    await t.showCol('note'); log('Y note →', await t.setCellKey(Y, 'note', '盤内上段に配置')); log('publish Rev3 →', await t.publish('2'))
    p = await t.proj(); log('Y', h.show(p, Y), '|', await h.status(Y)); log('subs', subsOf(p, Y))
    await t.role('purchasing'); const n0 = t.downloads.length; log('formal again →', await t.requestFormal()); const sh = await sheetsOf(n0)
    const fY = new Set(sh.filter((s) => s.rows.some((r) => r[0] === Y)).map((s) => s.f)); const mine = sh.filter((s) => fY.has(s.f))
    const diff = mine.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((r) => r[0] === Y); const main = mine.filter((s) => s.sh !== '差分').flatMap((s) => s.rows)
    log('files with Y', JSON.stringify(mine.map((s) => [s.f, s.sh]))); log('header', JSON.stringify(main.slice(0, 6))); log('diff Y', JSON.stringify(diff)); log('main Y', JSON.stringify(main.filter((r) => r[0] === Y)))
    p = await t.proj(); log('Y after formal again', h.show(p, Y), '|', await h.status(Y))
    const isRev2 = mine.some((s) => s.sh === '差分')
    check('I7-3 前回の正式依頼から必要数が変わった行（' + q0 + ' → ' + q0 * 3 + '）の再発行で、差分シートに必要数の変化が出る（あとの Rev で備考だけ変えても）', !isRev2 || diff.some((r) => r[1] === 'qtyNeeded'), `rev2=${isRev2} diff=${JSON.stringify(diff)}`)
  }
} else {
  await t.open('design')
  await t.press('5'); const v5 = await t.viewRows(); log('design 5 rows', v5.length)
  const A = v5[0]; await t.goto(A); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); log('design x', A, '→', await t.toast())
  await t.role('purchasing'); await t.press('5'); const v5p = await t.viewRows(); const B = v5p.includes(A) ? A : v5p[0]; await t.goto(B); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); log('purch x', B, '→', await t.toast())
  let p = await t.proj(); log('last subs', JSON.stringify(p.submissions.map((s) => [s.rev, s.rowIds.length, s.acked.length])))
  await t.role('pm'); const due1 = new Date(new Date(p.dueDate).getTime() - 3 * 86400000).toISOString().slice(0, 10); log('PM dueDate →', await h.setting('dueDate', due1, '前倒し'))
  p = await t.proj(); const dueRows = p.rows.filter((r) => p.submissions.some((s) => s.causes[r.id] === '案件納期変更')).map((r) => r.id); log('案件納期変更 rows', dueRows.length, 'has A', dueRows.includes(A), 'B', dueRows.includes(B))
  await t.role('design'); await t.press('5'); const d5 = await t.viewRows(); const cA = await t.cellText(A, 'cause')
  await t.role('purchasing'); await t.press('5'); const p5 = await t.viewRows(); const cB = await t.cellText(B, 'cause')
  log('design 5 has A', d5.includes(A), cA, '| purch 5 has B', p5.includes(B), cB)
  check('I7-4 5 で確認済にした行も、そのあとの案件納期の変更で必要日が変われば設計・購買の 5 に「案件納期変更」で出る（§9.3）', (!dueRows.includes(A) || (d5.includes(A) && /案件納期変更/.test(cA))) && (!dueRows.includes(B) || (p5.includes(B) && /案件納期変更/.test(cB))), `A=${A} in5=${d5.includes(A)} cause=${cA} / B=${B} in5=${p5.includes(B)} cause=${cB}`)
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i7-' + mode)
summary(); await t.close()
