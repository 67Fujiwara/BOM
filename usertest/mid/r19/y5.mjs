// y5: 4 の役割別の中身、相見積の依頼先の絞り込み（§7 取扱メーカ）、指定系の行の a、役割をまたぐ Undo
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
// ---- (1) 指定商社 R045（選定済・指定先（固定））に設計が a / Alt+A
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} snap=${r.scoreSnapshot ?? '-'}` }
log('before', show(p, 'R045'), '|', show(p, 'R034'))
await t.press('1'); await t.goto('R045'); await t.press('a'); await page.waitForTimeout(80); log('design a R045 →', await t.toast())
await t.goto('R034'); await t.press('a'); await page.waitForTimeout(80); log('design a R034 →', await t.toast())
p = await t.proj(); log('after', show(p, 'R045'), '|', show(p, 'R034'))
check('Y5-1 指定系の行（スコア無・固定、§3.4）に a を押しても採用理由「指定先（固定）」が消えずスコアが付かない', p.rows.find((r) => r.id === 'R045').adoptReason === '指定先（固定）' && p.rows.find((r) => r.id === 'R034').adoptReason === '指定先（固定）', show(p, 'R045') + ' | ' + show(p, 'R034'))
await t.press('Control+z'); await t.press('Control+z')
// ---- (2) 相見積の依頼先: パトライトの行（立花は扱わない）
await t.goto('R080'); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type('積層表示灯'); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
p = await t.proj(); const z = p.rows.find((r) => r.name === '積層表示灯').id
await t.setCellKey(z, 'model', 'LR6-302WJBW-RYG'); await t.setCellKey(z, 'maker', 'パトライト'); await t.setCellKey(z, 'qtyNeeded', '2'); await t.setCellKey(z, 'ref', 'PL1')
const z2 = await (async () => { await t.goto(z); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type('避雷器'); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape'); const pp = await t.proj(); return pp.rows.find((r) => r.name === '避雷器').id })()
await t.setCellKey(z2, 'model', 'LT-C32AC385A'); await t.setCellKey(z2, 'maker', '音羽電機'); await t.setCellKey(z2, 'qtyNeeded', '2'); await t.setCellKey(z2, 'ref', 'SPD1')
log('publish →', await t.publish('1'))
await t.role('purchasing'); const n0 = t.downloads.length; log('rough all →', await t.requestRough())
p = await t.proj(); const sup = (await t.ws()).suppliers
for (const id of [z, z2]) { const qs = p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId); const mk = p.rows.find((r) => r.id === id).maker; log(id, mk, 'requested to', qs.map((s) => { const x = sup.find((y) => y.id === s); return `${x.name}(${x.handledMakers.length ? (x.handledMakers.includes(mk) ? '扱う' : '扱わない') : '取扱メーカ未登録'})` }).join(', ')) }
const bad = [z, z2].flatMap((id) => { const mk = p.rows.find((r) => r.id === id).maker; return p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => sup.find((y) => y.id === q.supplierId)).filter((x) => x.handledMakers.length && !x.handledMakers.includes(mk)).map((x) => `${id}→${x.name}`) })
check('Y5-2 相見積の行は、行のメーカを扱わない商社（取扱メーカ登録あり）に依頼しない（§7「行のメーカから依頼可能な商社を自動で絞る」）', bad.length === 0, bad.join(', '))
// 依頼書の中身（その商社向けに入っているか）
for (const d of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const sh = wb.worksheets[0]; const ids = []; let sup2 = ''; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup2) sup2 = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); log('file', sup2, ids.join(',')) }
// ---- (3) 4 の役割別
await t.role('design'); log('bulk →', await t.bulk())
const four = async (role) => { await t.role(role); await t.press('4'); const rows = await t.viewRows(); const balls = {}; for (const id of rows.slice(0, 200)) { const b = await t.cellText(id, 'ball'); balls[b] = (balls[b] ?? 0) + 1 } return { n: rows.length, balls, rows } }
const d4 = await four('design'), b4 = await four('purchasing'), m4 = await four('pm')
log('design 4', d4.n, JSON.stringify(d4.balls)); log('purch 4', b4.n, JSON.stringify(b4.balls)); log('pm 4', m4.n, JSON.stringify(m4.balls))
await t.press('7'); const m7 = await t.viewRows(); log('pm 7', m7.length, 'pm4 not in 7', m4.rows.filter((x) => !m7.includes(x)).join(','), '7 not in 4', m7.filter((x) => !m4.rows.includes(x)).join(','))
await t.press('4'); await t.shot('y5-pm-view4')
// 設計の 4 の ボール≠設計 の行の理由
p = await t.proj()
const notMine = []
await t.role('design'); await t.press('4')
for (const id of d4.rows) { const b = await t.cellText(id, 'ball'); if (b !== '設計') { const r = p.rows.find((x) => x.id === id); notMine.push(`${id}:${b}:${r.status}:${Object.entries(r.flags).filter(([, v]) => v).map(([k]) => k).join('/')}`) } }
log('design 4 rows whose ball is not 設計', notMine.length, notMine.slice(0, 12).join(' '))
// ---- (4) 役割をまたぐ Undo: 購買が 6 で単価 → 設計が型式を変えて公開 → 購買 Ctrl+Z
await t.role('purchasing'); await t.press('6'); p = await t.proj()
const X = p.rows.find((r) => r.status === 'quoting' && r.id === z)?.id ?? z
log('X', X, show(p, X)); log(await t.setCellKey(X, 'q.unitPrice@S1', '15000')); await t.press('Escape'); log(await t.setCellKey(X, 'q.leadDays@S1', '10')); await t.press('Escape')
await t.role('design'); await t.press('1'); await t.setCellKey(X, 'model', 'LR6-302WJBW-RYGB'); log('design publish →', await t.publish('1'))
p = await t.proj(); log('X after design change', show(p, X), JSON.stringify(p.rows.find((r) => r.id === X).flags), JSON.stringify(p.quotes.filter((q) => q.rowId === X).map((q) => [q.supplierId, q.unitPrice, q.leadDays, !!q.stale])))
await t.role('purchasing'); await t.press('Control+z'); await page.waitForTimeout(100); const u1 = await t.toast(); log('purch Ctrl+Z #1 →', u1)
p = await t.proj(); log('X', JSON.stringify(p.quotes.filter((q) => q.rowId === X).map((q) => [q.supplierId, q.unitPrice, q.leadDays, !!q.stale])), 'model', p.rows.find((r) => r.id === X).model)
check('Y5-3 購買の Ctrl+Z は設計の公開した型式を戻さない（自分の操作だけ、§1）', p.rows.find((r) => r.id === X).model === 'LR6-302WJBW-RYGB')
summary(); await t.close()
