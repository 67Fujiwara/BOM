// f9: PM 承認待ちの変更セットの追加行を、承認する PM が見られるか（7・パレット・社内 Excel・保管用）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); await t.press('1')
const A = await h.addRow('R080', '承認待ちヒミツ部品', 'SECRET-123', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has A', v7.includes(A))
async function excel(idx) {
  const n0 = t.downloads.length
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120)
  for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const dl = t.downloads[n0]; if (!dl) return ['no download']
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const found = []
  wb.eachSheet((sh) => sh.eachRow((r) => { const txt = JSON.stringify(r.values); if (/SECRET-123/.test(txt)) found.push(sh.name) }))
  return found
}
const ex = { 社内: await excel(0), 保管用: await excel(2) }
log('PM excel', JSON.stringify(ex))
check('F9-1 承認する PM の社内・保管用 Excel には、承認待ちの追加行が載る（判断の材料）', ex['社内'].length > 0 && ex['保管用'].length > 0, JSON.stringify(ex))
summary(); await t.close()
