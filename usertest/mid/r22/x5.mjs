// x5: M4-05 の続き（購買の x の後に選定者の 4）、正式依頼中の数量変更 → 再見積要 → 据え置き → 再発行、重複の検出、先行発注の申請の記録
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('purchasing')
let p = await t.proj()
const st = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)}:q=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.formalPrice ?? null, q.reconfirm ?? '']))} iss=${p.issues.filter((i) => i.rowId === id).map((i) => i.id + ':' + i.kind + ':' + i.status).join(',')}` }
async function pick(id, label) { await t.goto(id); await t.press('Control+.'); await page.waitForTimeout(60); const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes(label)); if (i < 0) { log('NO OPTION', label, o); await t.press('Escape'); return } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80) }
// ---- 先行発注の申請 → PM 許可 → 記録（Space の詳細、Excel 変更点）
await t.press('1'); await t.goto('R020'); await t.cmd('先行発注を申請'); await page.waitForTimeout(80); await t.promptFill('長納期のため'); await t.extraFill('金額', '12,345'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100)
await t.role('pm'); await t.press('7'); const y = await t.yes('R020', '許可'); log('PM y R020 →', y.toast)
await t.goto('R020'); await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); const k = det.indexOf('決定'); log('PM detail decisions part:', det.slice(k, k + 400)); await t.press(' ')
check('X5-1 許可後、行の詳細（Space）に申請の理由・金額が見える', /長納期のため/.test(det) && /12,345/.test(det), '')
const nd = t.downloads.length; await t.press('Control+e'); await page.waitForTimeout(100); await t.press('1'); for (let i = 0; i < 40 && t.downloads.length === nd; i++) await page.waitForTimeout(100)
{ const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(t.downloads.at(-1).name); log('sheets', wb.worksheets.map((s) => s.name)); const sh = wb.worksheets.find((s) => /変更点|決定/.test(s.name)); const rows = []; sh?.eachRow((r) => { const v = r.values.slice(1).join('|'); if (/R020/.test(v)) rows.push(v) }); log('Excel R020 rows', JSON.stringify(rows)); check('X5-2 Excel（社内）の変更点に申請の金額が残る', rows.some((x) => /12,?345/.test(x)), JSON.stringify(rows)) }
// ---- M4-05 の続き
await t.role('design'); log('bulk →', await t.bulk())
p = await t.proj(); const D = p.rows.find((r) => r.status === 'selected' && !r.flags.contested && !r.flags.leadNG && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3 && !p.issues.some((i) => i.rowId === r.id)).id
await t.role('purchasing'); await t.press('1'); await t.goto(D); await t.press('Shift+I'); await t.press('k'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('型式を正確に'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('issue →', await t.publish())
await t.role('design'); await t.press('1'); await t.setCellKey(D, 'model', 'FIX-' + D); log('publish →', await t.publish())
p = await t.proj(); const adoptedD = p.rows.find((r) => r.id === D).adoptedSupplierId
await t.role('purchasing'); await t.press('5'); const sups = (await t.ws()).suppliers.filter((s) => ['S1', 'S2', 'S3'].includes(s.id))
for (const s of sups) await pick(D, `${s.name}: ${s.id === adoptedD ? '再見積' : '据え置き'}`)
p = await t.proj(); log('D after reconfirm', st(p, D))
await t.press('4'); log('purch 4 has D?', (await t.viewRows()).includes(D))
const nd2 = t.downloads.length; log('rough →', await t.requestRough()); p = await t.proj(); log('D after rough', st(p, D))
await t.press('6'); await t.setCellKey(D, 'q.unitPrice@' + adoptedD, '50000'); await t.press('Escape'); await t.setCellKey(D, 'q.leadDays@' + adoptedD, '5'); await t.press('Escape')
p = await t.proj(); log('D after answer', st(p, D), 'ball', await t.cellText(D, 'ball'))
await t.press('1'); await t.goto(D); log('purch status bar', (await t.status()).slice(0, 120)); await t.press('x'); await page.waitForTimeout(80); log('purch x →', await t.toast())
p = await t.proj(); log('D after x', st(p, D), 'ball', await t.cellText(D, 'ball'))
await t.role('design'); await t.press('4'); const d4 = await t.viewRows(); log('design 4 has D?', d4.includes(D))
check('X5-3 採用商社を再見積にした行は、回答・確認のあと選定者の 4 に出る', d4.includes(D), await t.cellText(D, 'ball'))
// ---- 正式依頼中の数量変更 → 再見積要＋再発行 → 据え置き → 正式見積を依頼（Rev+1、差分）
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); const F = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.contested && !r.flags.leadNG && r.id !== D).id; log('F', st(p, F), 'qty', p.rows.find((r) => r.id === F).qtyNeeded)
await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === F).qtyNeeded; await t.setCellKey(F, 'qtyNeeded', String(q0 + 1)); log('publish →', await t.publish('1'))
p = await t.proj(); log('F after qty+1', st(p, F))
await t.role('purchasing'); await t.press('9'); await t.goto(F); await t.press('Control+.'); await page.waitForTimeout(60); const of = (await t.panel())?.options ?? []; log('F Ctrl+. (9)', JSON.stringify(of))
const ik = of.findIndex((x) => x.includes('据え置き')); if (ik >= 0) { for (let k2 = 0; k2 < ik; k2++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(100) } else await t.press('Escape')
p = await t.proj(); log('F after keep', st(p, F))
await t.press('8'); log('purch 8 has F (reissue)?', (await t.viewRows()).includes(F), 'cell', await t.cellText(F, 'status'))
const nd3 = t.downloads.length; log('formal again →', await t.requestFormal()); await page.waitForTimeout(800)
p = await t.proj(); log('F after reissue', st(p, F), 'reqNo', JSON.stringify(p.quotes.find((q) => q.rowId === F && q.supplierId === p.rows.find((r) => r.id === F).adoptedSupplierId && !q.stale)?.formalRequestNo))
for (const d of t.downloads.slice(nd3)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const diff = wb.worksheets.find((s) => /差分/.test(s.name)); if (diff) { const rows = []; diff.eachRow((r) => rows.push(r.values.slice(1).join('|'))); if (rows.some((x) => x.includes(F))) log('diff sheet', JSON.stringify(rows.filter((x) => x.includes(F) || /旧|新/.test(x)).slice(0, 4))) } }
check('X5-4 正式依頼中の数量変更を据え置きにしても、再発行（Rev+1）の依頼で正式依頼中に戻る', p.rows.find((r) => r.id === F).status === 'formalRequested' && !p.rows.find((r) => r.id === F).flags.reissue && !p.rows.find((r) => r.id === F).flags.requote, st(p, F))
// ---- 重複: 本物の重複は出るか（行の複製・回路記号の書き換え）
await t.role('design'); await t.press('1'); const p1 = await t.proj(); const refA = p1.rows.find((r) => r.id === 'R010').ref
await t.goto('R080'); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type('重複テスト'); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
p = await t.proj(); const nr = p.rows.find((r) => r.name === '重複テスト').id; await t.setCellKey(nr, 'ref', refA)
const pr = await page.evaluate(async (id) => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return r.checkRow(p.rows.find((x) => x.id === id), s.ws.rules, p).map((x) => x.severity + ':' + x.message) }, nr)
log('dup problems', refA, pr); check('X5-5 本当の回路記号の重複は警告される', pr.some((x) => /重複/.test(x)))
// 置換の新行の回路記号を別の行と同じにする
log('r R012 →', await t.replace('R012', 'NEWR012')); p = await t.proj(); const rep = p.rows.find((r) => r.replaces === 'R012').id; const refB = p.rows.find((r) => r.id === 'R013').ref; await t.setCellKey(rep, 'ref', refB)
const pr2 = await page.evaluate(async (id) => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return r.checkRow(p.rows.find((x) => x.id === id), s.ws.rules, p).map((x) => x.severity + ':' + x.message) }, rep)
log('replacement with other ref', refB, pr2); check('X5-6 置換の新行でも、置換元以外との重複は警告される', pr2.some((x) => /重複/.test(x)))
summary(); await t.close()
