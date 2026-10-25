// l11: 承認 ON。変更セット（A の必要数）を PM が却下 → 設計がそのまま出し直す → PM が承認。3 役割の社内 Excel の変更点
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel0() { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); await page.keyboard.press('Enter'); await page.waitForTimeout(3000); return sheetsOf(n0) }
await t.open('design'); log('publish drafts →', await t.publish('1'))
await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const A = p.rows.find((r) => !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
const qA = A.qtyNeeded
await t.press('1'); log('A qty →', await t.setCellKey(A.id, 'qtyNeeded', String(qA + 1))); log('publish Rev.a →', await t.publish('1'))
p = await t.proj(); const revA = p.submissions.at(-1).rev
await t.role('pm'); await t.press('7'); log('PM Shift+Y →', (await t.decide(A.id, 'Shift+Y', '根拠資料を付けて出し直して')).toast)
await t.role('design'); p = await t.proj(); log('A working', JSON.stringify(p.rows.find((r) => r.id === A.id).working ?? null))
log('publish Rev.b (same) →', await t.publish('1')); p = await t.proj(); const revB = p.submissions.at(-1).rev
await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(A.id, '資料確認、承認')).toast)
p = await t.proj(); log('A qty', p.rows.find((r) => r.id === A.id).qtyNeeded)
for (const role of ['design', 'purchasing', 'pm']) {
  await t.role(role); const ex = await excel0(); const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === A.id)
  log(role, '変更点 A', JSON.stringify(chg.map((r) => [r[0], r[5], r[7], r[8]])))
  const rb = chg.find((r) => r[0] === revB)
  check(`L11-${role} 変更点：承認した Rev.${revB} に A の必要数 ${qA} → ${qA + 1} が出る（却下した Rev.${revA} と比べて空にならない）`, rb && new RegExp(`qtyNeeded: ${qA} → ${qA + 1}`).test(String(rb[7])), JSON.stringify(rb ?? null))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
