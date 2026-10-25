// ラウンド23 s03: Excel 社内出力の「チェック結果」シートの日本語表示（列名・状態・項目）。チェックの行（【削除？】など）と指摘の行
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, T, makeLog, ui, proj, sleep, shot, palette, setRole, store } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's03_export_check')
const OUT = '/home/user/BOM/usertest/newbie/r23/dl/'
async function exportPick(n, tag) {
  await palette(page, 'Excel'); await page.keyboard.press('Enter'); await sleep(200)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.keyboard.press(String(n)); await sleep(100)
  if ((await ui(page)).panel) await page.keyboard.press('Enter')
  const d = await dl; await sleep(300)
  if (!d) { log(`  [${tag}] download なし toast=${await T.toast(page)}`); return null }
  const f = OUT + 's03_' + tag + '.xlsx'; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  const sh = wb.getWorksheet('チェック結果')
  if (!sh) { log(`  [${tag}] チェック結果シート なし: ${wb.worksheets.map((w) => w.name).join(',')}`); return f }
  const rows = []; sh.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? ''))))
  log(`  [${tag}] チェック結果 ${rows.length} 行。見出し: ${rows[0]?.join(' | ')}`)
  const raw = new Set(); const stat = new Set(); const fld = new Set()
  for (const r of rows.slice(1)) { fld.add(r[1]); stat.add(r[5]); for (const c of r) if (typeof c === 'string' && /^[a-z]+[A-Z]?[A-Za-z]*$/.test(c) && c.length > 2) raw.add(c) }
  log(`     項目(列2) の種類: ${[...fld].join(',')} / 状態(列6): ${[...stat].join(',')} / 英字だけのセル: ${[...raw].join(',') || '-'}`)
  for (const r of rows.slice(1, 6)) log('     ' + r.map((c) => String(c).slice(0, 50)).join(' | '))
  return f
}
log('== A 設計：ガイドで作った BOM（【削除？】・型式空欄のエラー）を社内出力')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 3; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
rows.push('数量なし\tZ-1\tZ-1\t\t\t')
await wizardPaste(page, ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n'))
await page.keyboard.press('Enter'); await sleep(500)
await exportPick(1, 'A_wizard_internal')
log('== B デモ BOM（指摘・見積あり）を 設計 / 購買 / PM で社内出力')
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  await exportPick(1, 'B_demo_' + role)
}
save(errors); await browser.close()
