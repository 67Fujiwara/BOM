// f1: 作業中（未公開）・承認待ち（変更セット、既存行の型式変更）の値が、購買・PM のパレット・Excel に出ないか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); await t.press('1')
log('R011 model →', await t.setCellKey('R011', 'model', 'PEND-777'))
log('publish →', await t.publish('1'))
log('R010 model (WIP) →', await t.setCellKey('R010', 'model', 'WIP-ZZZ-999'))
log('R010 name (WIP) →', await t.setCellKey('R010', 'name', 'ナイショ部品'))
let p = await t.proj(); const r10 = p.rows.find((r) => r.id === 'R010'), r11 = p.rows.find((r) => r.id === 'R011')
log('R010 model', r10.model, 'working', JSON.stringify(r10.working), '| R011 model', r11.model, 'pendingApproval', JSON.stringify(r11.pendingApproval), 'flags', JSON.stringify(r11.flags))
async function pal(q) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await page.waitForTimeout(150); const it = await page.getByTestId('palette-list').locator('.item').allTextContents(); await page.keyboard.press('Escape'); return it }
async function excel(idx) {
  const n0 = t.downloads.length
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120)
  for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const dl = t.downloads[n0]; if (!dl) return ['no download']
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const found = []
  wb.eachSheet((sh) => sh.eachRow((r) => { const txt = JSON.stringify(r.values); if (/PEND-777|WIP-ZZZ|ナイショ/.test(txt)) found.push(sh.name + ': ' + txt.slice(0, 160)) }))
  return found
}
const res = {}
for (const role of ['purchasing', 'pm']) {
  await t.role(role); await t.press('1')
  const grid10 = await t.cellText('R010', 'model'), grid11 = await t.cellText('R011', 'model')
  const p10 = await pal('R010'), p11 = await pal('R011'), p10b = await pal('10')
  log(role, 'grid model R010', grid10, 'R011', grid11)
  log(role, 'palette R010', JSON.stringify(p10.slice(0, 3)))
  log(role, 'palette 10', JSON.stringify(p10b.slice(0, 2)))
  log(role, 'palette R011', JSON.stringify(p11.slice(0, 3)))
  const ex = {}
  for (const [label, idx] of [['社内', 0], ['商社向け', 1], ['保管用', 2]]) { ex[label] = await excel(idx); log(role, 'excel', label, JSON.stringify(ex[label])) }
  res[role] = { grid10, grid11, p10, p11, ex }
}
check('F1-1 購買のパレット（行 ID）に、設計の作業中（未公開）の型式・部品名が出ない', !/WIP-ZZZ|ナイショ/.test(res.purchasing.p10.join()), res.purchasing.p10[0])
check('F1-2 購買のパレット（行 ID）に、PM 承認待ちの変更セットの新しい型式が出ない（表の公開値と同じ）', !/PEND-777/.test(res.purchasing.p11.join()), res.purchasing.p11[0] + ' / grid ' + res.purchasing.grid11)
check('F1-3 PM のパレットに設計の作業中（未公開）の値が出ない', !/WIP-ZZZ|ナイショ/.test(res.pm.p10.join()), res.pm.p10[0])
check('F1-4 購買の社内 Excel（変更点）に、PM 承認待ちの変更セットの中身（型式の新旧）が出ない', !res.purchasing.ex['社内'].some((x) => /PEND-777/.test(x)), JSON.stringify(res.purchasing.ex['社内']))
check('F1-5 購買の保管用 Excel に、PM 承認待ちの変更セットの中身が出ない', !res.purchasing.ex['保管用'].some((x) => /PEND-777/.test(x)), JSON.stringify(res.purchasing.ex['保管用']))
check('F1-6 購買・PM の Excel に設計の作業中（未公開）の値が出ない', ![...Object.values(res.purchasing.ex), ...Object.values(res.pm.ex)].flat().some((x) => /WIP-ZZZ|ナイショ/.test(x)))
await t.shot('f1')
summary(); await t.close()
