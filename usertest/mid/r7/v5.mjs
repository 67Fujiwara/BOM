// v5: 設計変更の PM 承認 ON → 承認待ち → 購買からの見え方・Excel → 却下 / 承認。取消・置換・追加も承認を通るか
// 再検証: M-09, M-10, M-22, M-28 ／ 新規: 取消・置換が承認前に反映、却下で置換元が戻らない
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('pm')
await t.cmd('案件設定'); await page.waitForTimeout(80)
const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'changeNeedsPmApproval') })
for (let i = 0; i < idx; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80)
await t.promptFill('設計変更は承認制にする'); await t.press('Enter'); await page.waitForTimeout(80)
log('approval ON:', (await t.proj()).settings.changeNeedsPmApproval)
// 設計: 公開済の行を変更
await t.role('design'); await t.press('1'); await t.showCol('needOffset')
log(await t.setCellKey('R040', 'model', 'E32-D11 5M'))
log(await t.setCellKey('R042', 'qtyNeeded', '2'))
log(await t.setCellKey('R010', 'needOffset', '-5'))
const q40before = (await t.quotes('R040')).filter((q) => !q.stale).map((q) => [q.supplierId, q.unitPrice])
// 購買: 作業中の値は見えない（M-10 Excel・M-22 必要日）
await t.role('purchasing'); await t.press('1')
const nd10p = await t.cellText('R010', 'needDate'); await t.role('design'); await t.press('1'); const nd10d = await t.cellText('R010', 'needDate'); await t.role('purchasing'); await t.press('1')
log('R010 needDate purchasing', nd10p, 'design', nd10d)
check('M-22 購買の必要日は公開値（設計の作業中は反映しない）', nd10p !== nd10d, `${nd10p} vs ${nd10d}`)
await t.press('Control+e'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(1500)
let dl = t.downloads.at(-1); let wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name)
let sh = wb.getWorksheet('BOM'); let hdr = sh.getRow(1).values; let r40 = null; sh.eachRow((row) => { if (row.values[1] === 'R040') r40 = row.values })
log('purchasing internal Excel R040 model:', r40?.[hdr.indexOf('型式')])
check('M-10 購買の Excel に設計の作業中の値が出ない', r40?.[hdr.indexOf('型式')] === 'E32-D11 2M')
// 設計: 公開（変更セット・承認待ち）。あわせて取消・置換・追加
await t.role('design'); await t.press('1')
await t.goto('R050'); await t.press('Shift+Delete'); await page.waitForTimeout(60); log('cancel →', await t.toast())
log('r →', await t.replace('R060', 'AB150-N'))
let p = await t.proj(); const rep = p.rows.find((r) => r.replaces === 'R060'); log('replace →', rep?.id, rep?.model, 'R060', p.rows.find((r) => r.id === 'R060').status)
// 購買から（公開前）
await t.role('purchasing'); await t.press('1')
const s50 = await t.cellText('R050', 'status'), s60 = await t.cellText('R060', 'status'); log('purchasing before publish: R050', s50, 'R060', s60)
check('M3 公開前の取消・置換は購買に見えない', !/取消/.test(s50) && !/置換/.test(s60), `${s50} / ${s60}`)
await t.role('design'); await t.press('1')
await t.press('Control+Enter'); await page.waitForTimeout(100); log('publish try →', JSON.stringify(await t.panel())?.slice(0,80), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.goto(rep.id); await t.colKey('ref'); await t.press('x'); log('x dup ref →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); log('publish dialog:', pn?.title)
if (pn?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(100) }
pn = await t.panel(); if (pn) { log('2nd', pn.title); await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
p = await t.proj(); log('subs', p.submissions.slice(1).map((s) => `Rev${s.rev}[${s.rowIds.join(',')}] cs=${JSON.stringify(s.changeSet)}`).join(' / '))
log('pending rows', p.rows.filter((r) => r.flags.pmPending).map((r) => `${r.id}:${r.status}:${r.flags.pmReason}`).join(' '))
// 購買の見え方（承認前）
await t.role('purchasing'); await t.press('1')
const m40 = await t.cellText('R040', 'model'), st40 = await t.cellText('R040', 'status'), st50 = await t.cellText('R050', 'status'), st60 = await t.cellText('R060', 'status'), stRep = await t.cellText(rep.id, 'status')
const q40 = (await t.quotes('R040')).filter((q) => !q.stale).map((q) => [q.supplierId, q.unitPrice])
log('purchasing after publish (pending): R040', m40, st40, 'quotes', JSON.stringify(q40), '| R050', st50, '| R060', st60, '|', rep.id, stRep)
check('M-09 承認待ちの型式変更は購買に旧値のまま、見積も失効しない', m40 === 'E32-D11 2M' && JSON.stringify(q40) === JSON.stringify(q40before))
check('M3 承認ON: 取消は PM 承認まで反映されない（購買には承認待ちとして見える）', !/^取消/.test(st50), st50)
check('M3 承認ON: 置換は PM 承認まで反映されない', !/^置換済/.test(st60), st60)
// 購買: 承認待ちの追加行・置換行に概算見積を依頼できるか
await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800); log('request →', await t.toast())
// PM: 7 で却下
await t.role('pm'); await t.press('7'); log('PM 7 includes', ['R040', 'R042', 'R010', 'R050', rep.id].map((x) => x + ':' + (0)).join(''))
const v7 = await t.viewRows(); log('PM 7 rows:', v7.filter((x) => ['R040', 'R042', 'R010', 'R050', 'R060', rep.id].includes(x)).join(','))
await t.goto('R040'); await t.press('Shift+y'); await page.waitForTimeout(60); await t.promptFill('型式変更は不要'); await t.press('Enter'); await page.waitForTimeout(100)
log('reject →', await t.toast())
p = await t.proj()
const after = (id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:model=${r.model}:working=${JSON.stringify(r.working ?? null)}:f=${JSON.stringify(r.flags)}` }
log(after('R040')); log(after('R042')); log(after('R050')); log(after('R060')); log(after(rep.id))
log('R040 quotes after reject', JSON.stringify(p.quotes.filter((q) => q.rowId === 'R040').map((q) => [q.supplierId, q.unitPrice, q.stale ? 'stale' : 'live'])))
const r60 = p.rows.find((x) => x.id === 'R060'), rN = p.rows.find((x) => x.id === rep.id), r50 = p.rows.find((x) => x.id === 'R050')
check('M-09b 却下で型式変更は設計の作業中に戻り、見積は有効のまま', p.rows.find((x) => x.id === 'R040').working?.model === 'E32-D11 5M' && p.quotes.filter((q) => q.rowId === 'R040' && !q.stale && q.unitPrice != null).length >= 2)
check('M3 却下で取消が取り消される（R050 が元の状態に戻る）', r50.status !== 'cancelled', r50.status)
check('M3 却下で置換が取り消される（置換元 R060 が有効に戻るか、置換先が作業中として残る）', r60.status !== 'replaced' || (rN.status !== 'draft' && rN.status !== 'cancelled'), `R060=${r60.status} ${rep.id}=${rN.status}`)
// 設計: 4 / 作業中の確認 → もう一度公開 → PM 承認
await t.role('design'); await t.press('1')
await t.press('Control+Enter'); await page.waitForTimeout(100); pn = await t.panel(); log('re-publish dialog:', pn?.title)
if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
pn = await t.panel(); if (pn) { await t.press('Enter'); await page.waitForTimeout(80) }
log('re-publish →', await t.toast())
await t.role('pm'); await t.press('7'); await t.goto('R040'); await t.press('y'); await page.waitForTimeout(60); await t.promptFill('承認'); await t.press('Enter'); await page.waitForTimeout(100)
log('approve →', await t.toast())
p = await t.proj(); log(after('R040')); log('R040 quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === 'R040').map((q) => [q.supplierId, q.unitPrice, q.stale ? 'stale' : 'live'])))
const r40a = p.rows.find((x) => x.id === 'R040')
check('M-09c 承認で型式変更が公開値に反映・再見積要', r40a.model === 'E32-D11 5M' && r40a.flags.requote)
// Undo across roles: 設計の Ctrl+Z は PM が承認した変更を勝手に戻さない
await t.role('design'); await t.press('Control+z'); await page.waitForTimeout(80); log('design Ctrl+Z →', await t.toast())
p = await t.proj(); log('after design undo', after('R040'), 'sub revoked?', JSON.stringify(p.submissions.at(-1).changeSet))
summary(); await t.close()
