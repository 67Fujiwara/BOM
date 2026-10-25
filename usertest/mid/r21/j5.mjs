// j5: 取消・置換した行の正式依頼取下げ（M15-02 の修正）の後始末と出力
//   G: 正式依頼中の行を取消、H: 正式見積済の行を置換 → 購買の 4・F8・ステータスバー・x・Ctrl+Z、8、Excel（社内・保管用・商社向け）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excel(idx, pick) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); if (pick != null) { const pn = await t.panel(); log('excel sub-panel', JSON.stringify(pn?.options ?? [])); const i = (pn?.options ?? []).findIndex((o) => o.includes(pick)); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } await page.waitForTimeout(1500); return sheetsOf(n0) }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.altPolicy !== '客先承認要' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const G = fr[0].id, H = fr[1].id
const ad = Object.fromEntries([G, H].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
const fp = p.quotes.find((x) => x.rowId === H && x.supplierId === ad[H] && !x.stale).unitPrice
await t.press('8'); await t.setCellKey(H, 'q.formalPrice@A', String(fp)); await t.press('Escape'); await t.press('Escape')
await t.role('design'); await t.press('1')
await t.goto(G); await t.press('Shift+Delete'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) } } log('G delete →', await t.toast())
log('H replace →', await t.replace(H, 'REPL-J5'))
log('publish →', await t.publish('1'))
p = await t.proj(); const newH = p.rows.find((r) => r.model === 'REPL-J5')?.id
for (const id of [G, H, newH]) log('after publish', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id)?.flags.formalWithdrawn ?? '-', '|', await h.status(id))
const W = Object.fromEntries([G, H].map((id) => [id, p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '']))
check('J5-0 取消・置換した正式依頼中・正式見積済の行に「正式依頼取下げ」（M15-02）', [G, H].every((id) => /F\d/.test(W[id])), JSON.stringify(W))
await t.role('purchasing'); await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has G,H,newH', v4.includes(G), v4.includes(H), v4.includes(newH))
await t.press('8'); const v8 = await t.viewRows(); log('purch 8 has G,H', v8.includes(G), v8.includes(H))
// F8 で止まり、ステータスバーに取下げ
await t.press('4'); await t.goto(v4[0]); await t.press('Home'); const seen = {}
for (let i = 0; i < v4.length + 6; i++) { await page.keyboard.press('F8'); await page.waitForTimeout(60); const r = await t.curRow(); if ([G, H].includes(r) && !seen[r]) seen[r] = (await t.status()).slice(0, 200) }
log('F8 statusbars', JSON.stringify(seen))
check('J5-1 取消・置換した行の取下げは購買の 4 に出て、F8 で止まりステータスバーに「取り下げ…x」', [G, H].every((id) => v4.includes(id) && /取り下げ/.test(seen[id] ?? '')), JSON.stringify({ in4: [G, H].map((id) => v4.includes(id)), seen }))
// Excel（購買の社内・保管用）に取下げ・取消が分かるか
const ex1 = await excel(0); const bom1 = ex1.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows); const chg1 = ex1.filter((s) => s.sh === '変更点').flatMap((s) => s.rows)
const head1 = bom1[0]; const stCol = head1.indexOf('状態'); const fpCol = head1.indexOf('正式単価')
log('社内 BOM G', JSON.stringify(bom1.find((r) => r[0] === G)?.slice(stCol - 6, stCol + 2))); log('社内 BOM H', JSON.stringify(bom1.find((r) => r[0] === H)?.slice(stCol - 6, stCol + 2)))
log('社内 変更点 G,H', JSON.stringify(chg1.filter((r) => [G, H, newH].includes(r[3]))))
const chgG = chg1.filter((r) => r[3] === G); const chgH = chg1.filter((r) => r[3] === H)
check('J5-2 購買の社内 Excel の変更点に取消・置換の内容が出る（起因だけでなく内容欄が空でない）', chgG.some((r) => String(r[7] ?? '').length > 0) && chgH.some((r) => String(r[7] ?? '').length > 0), JSON.stringify({ chgG, chgH }))
const ex3 = await excel(2); const bom3 = ex3.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows); const h3 = bom3[0]
log('保管用 H', JSON.stringify(bom3.find((r) => r[0] === H)?.slice(h3.indexOf('発注数'), h3.indexOf('ボール') + 1)), 'head', JSON.stringify(h3.slice(h3.indexOf('発注数'), h3.indexOf('ボール') + 1)))
log('INFO 保管用の置換済の行の正式単価', bom3.find((r) => r[0] === H)?.[h3.indexOf('正式単価')], '（置換前は', fp, '）')
// x で外す・Ctrl+Z
await t.press('4'); await t.goto(G); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); const xg = await t.toast(); p = await t.proj()
log('x G →', xg, 'flag', p.rows.find((r) => r.id === G).flags.formalWithdrawn ?? '-')
check('J5-3 取消した行の取下げも購買の x で外れ、知らせが出る（U15-04）', !p.rows.find((r) => r.id === G).flags.formalWithdrawn && /取下げ|取り下げ/.test(xg), xg)
await t.press('4'); const v4b = await t.viewRows(); log('purch 4 after x has G', v4b.includes(G))
check('J5-4 x のあと取消した行は購買の 4 から外れる', !v4b.includes(G), String(v4b.includes(G)))
await t.press('1'); await t.goto(G); await page.keyboard.press('Control+z'); await page.waitForTimeout(100); p = await t.proj(); const uz = await t.toast()
log('Ctrl+Z →', uz, 'flag', p.rows.find((r) => r.id === G).flags.formalWithdrawn ?? '-')
check('J5-5 取消した行の取下げ確認も Ctrl+Z で戻る', !!p.rows.find((r) => r.id === G).flags.formalWithdrawn, uz)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j5')
summary(); await t.close()
