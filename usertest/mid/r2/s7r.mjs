import { launch, check, log } from './lib.mjs'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
const t = await launch()
const { page } = t
await t.open('design')
// ---- 先行発注判断（自動）: R076-R080 を公開 → 依頼 → 長納期の回答
await t.press('Control+Enter'); await page.waitForTimeout(80); let dlg = await t.dialog(); if (/Rev/.test(dlg)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('publish drafts →', await t.toast())
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await Promise.all([page.waitForEvent('download', { timeout: 4000 }).catch(() => null), t.press('Enter')]); await page.waitForTimeout(400)
log('request →', await t.toast())
await t.press('6')
const tsv = Array.from({ length: 5 }, (_, i) => [`${1000 + i}\t40\t\t受注生産\t2026-12-31`, `${1100 + i}\t45\t\t受注生産\t2026-12-31`, `${900 + i}\t50\t\t受注生産\t2026-12-31`].join('\t')).join('\n')
await page.evaluate((s) => navigator.clipboard.writeText(s), tsv)
await t.goto('R076'); await t.colKey('q.unitPrice@S1'); await t.press('Control+v'); await page.waitForTimeout(400)
log('paste →', await t.toast())
let p = await t.proj()
log('R076..80:', p.rows.filter((r) => /R07[6-9]|R080/.test(r.id)).map((r) => `${r.id}:${r.status}:${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}`).join(' '))
const ltb = p.rows.find((r) => r.flags.ltbPending)
check('S7 長納期の見積済で先行発注判断が自動で付く', !!ltb)
// PM: 7 → y
await t.role('pm'); await t.press('7'); await t.goto(ltb.id); await t.press('Enter'); log('panel 先行発注判断:', await page.getByTestId('quickfix').textContent().catch(() => t.toast())); await t.press('Escape')
await t.goto(ltb.id); await t.press('y'); await page.waitForTimeout(60); await page.getByTestId('prompt-text').fill('長納期のため許可'); await t.press('Enter'); await page.waitForTimeout(80)
let rl = await t.row(ltb.id); log('LTB y →', await t.toast(), rl.status, rl.adoptedSupplierId, JSON.stringify(rl.flags))
check('S7 先行発注判断の y で推奨商社で選定済＋先行', rl.status === 'selected' && !!rl.adoptedSupplierId && rl.flags.early === true, `${rl.status} adopted=${rl.adoptedSupplierId}`)
// 購買: 先行の行を発注
await t.role('purchasing'); await t.press('1'); await t.goto(ltb.id); await t.press('o'); await page.waitForTimeout(50)
rl = await t.row(ltb.id); log('o on early →', await t.toast(), rl.status, rl.adoptedSupplierId)
check('S7 発注済の行には採用商社がある', rl.status !== 'ordered' || !!rl.adoptedSupplierId, `${rl.status} adopted=${rl.adoptedSupplierId}`)
// 先行発注を申請（購買）
const other = p.rows.find((r) => r.status === 'quoted' && !r.flags.ltbPending)
await t.goto(other.id); await t.cmd('先行発注を申請'); await page.waitForTimeout(50); log('ltb.request dlg:', (await t.dialog()).slice(0, 80)); await page.getByTestId('prompt-text').fill('長納期部品'); await t.press('Enter'); await page.waitForTimeout(60)
log('申請 →', JSON.stringify((await t.row(other.id)).flags))
// 3 ビュー
await t.press('3'); log('view3 cols:', (await page.locator('thead th').allTextContents()).join('|'), 'rows', await t.rowCount())
await t.shot('s7-view3')
// ---- Excel 3 種
await t.role('pm'); await t.press('1')
for (const [k, name] of [['1', 'internal'], ['2', 'supplier'], ['3', 'archive']]) {
  await t.press('Control+e'); await page.waitForTimeout(60)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), t.press(k)])
  if (!dl) { log('no download', name, await t.toast()); continue }
  const f = `usertest/mid/r2/shots/export-${name}.xlsx`; await dl.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  const sheets = wb.worksheets.map((w) => `${w.name}(${w.rowCount})`)
  const bom = wb.getWorksheet('BOM'); const head = bom.getRow(1).values.slice(1)
  let r076 = null; bom.eachRow((row) => { if (row.getCell(1).value === ltb.id) r076 = row.values.slice(1) })
  log('excel', name, 'name=', dl.suggestedFilename(), 'sheets', sheets.join(','), 'head', head.join('|').slice(0, 200))
  log('   row', ltb.id, JSON.stringify(r076)?.slice(0, 200))
  if (name === 'supplier') check('S7 商社向け Excel に価格・採用・スコアの列がない', !head.some((h) => /単価|金額|採用|スコア/.test(String(h))), head.join('|'))
  if (name === 'archive') { let cancelled = 0; bom.eachRow((row) => { if (row.font?.strike) cancelled++ }); log('   archive rows', bom.rowCount) }
}
// ---- 書式つきコピー
await t.press('Control+Shift+C'); await page.waitForTimeout(150)
const clip = await page.evaluate(async () => { try { const items = await navigator.clipboard.read(); const out = []; for (const it of items) for (const ty of it.types) out.push(ty + ':' + (await (await it.getType(ty)).text()).slice(0, 300)); return out } catch (e) { return ['ERR ' + e.message] } })
log('copy →', await t.toast(), 'clipboard:', clip.map((c) => c.slice(0, 200).replace(/\n/g,' / ')))
// ---- JSON 書き出し → 読み込み往復
const before = await t.ws()
const [jd] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), t.cmd('JSON を書き出す')])
let jsonText = null
if (jd) { const f = 'usertest/mid/r2/shots/ws.json'; await jd.saveAs(f); jsonText = fs.readFileSync(f, 'utf8'); log('json name', jd.suggestedFilename(), 'bytes', jsonText.length) }
await t.role('design'); await t.press('1'); await t.setCell('R050', '備考', '読み込み前に変更'); 
await t.cmd('JSON を読み込む'); await page.waitForTimeout(80)
await page.evaluate((txt) => { const el = document.querySelector('[data-testid="import-text"]'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(el, txt); el.dispatchEvent(new Event('input', { bubbles: true })) }, jsonText); await page.waitForTimeout(200); await page.getByTestId('import-text').focus(); await t.press('Control+Enter'); await page.waitForTimeout(400)
log('import json →', await t.toast())
const after = await t.ws()
const strip = (w) => JSON.stringify(w.projects.map((p) => ({ ...p, events: undefined, version: undefined, updatedAt: undefined })))
check('S7 JSON 書き出し→読み込みで内容が往復する', strip(before) === strip(after), `before=${strip(before).length} after=${strip(after).length}`)
if (strip(before) !== strip(after)) { const a = JSON.parse(strip(before))[0], b = JSON.parse(strip(after))[0]; for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) log('   diff key', k, JSON.stringify(a[k]).slice(0, 150), '→', JSON.stringify(b[k]).slice(0, 150)) }
log('role after import:', (await t.ws()).user)
// ---- リロード後の保持
await t.setCell('R051', '備考', 'リロード前'); const rv = (await t.proj()).version
await t.reload(); await t.press('1')
log('after reload note:', JSON.stringify((await t.row('R051')).working ?? (await t.row('R051')).note), 'role button:', await page.getByTestId('role-design').getAttribute('aria-pressed'), 'view', await page.getByTestId('view-1').getAttribute('aria-current'))
await t.press('Control+z'); await page.waitForTimeout(50); log('Ctrl+Z after reload →', await t.toast())
// ---- 受信箱
await t.press('Control+p'); await page.waitForTimeout(80); log('inbox:', (await page.getByTestId('inbox').textContent().catch(() => '')).slice(0, 300)); await t.press('Escape')
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
