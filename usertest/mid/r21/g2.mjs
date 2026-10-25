// g2: 再発行対象の行の発注止め（M13-04 の修正）を発注の経路ごとに。数量の変更・案件納期の変更・古いデータの印
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed)
const [Y, W, V] = [fr[1].id, fr[2].id, fr[3].id]
await t.press('8')
for (const id of [Y, W, V]) { const r = fr.find((x) => x.id === id); const q = p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
await t.press('Escape')
p = await t.proj(); for (const id of [Y, W, V]) log('before', h.show(p, id), '|', await h.status(id))
// (1) 数量の変更 → 据え置き → 発注の 4 経路
await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === Y).qtyNeeded; await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3))
log('publish →', await t.publish('2'))
await t.role('purchasing'); await t.press('9')
await t.goto(Y); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const o = (await t.panel())?.options ?? []
const i = o.findIndex((x) => x.includes('据え置き（旧見積')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); const keepMsg = await t.toast(); log('keep →', keepMsg)
p = await t.proj(); log('after keep', h.show(p, Y), '|', await h.status(Y))
check('G2-0 (U13-01) 据え置きの知らせが「採用はそのまま」「再発行」を言う', /採用はそのまま/.test(keepMsg) && /再発行/.test(keepMsg), keepMsg)
const oKey = await t.order(Y); p = await t.proj(); let r = p.rows.find((x) => x.id === Y); log('o →', oKey, r.ordered)
check('G2-1 再発行対象の行は o で発注できず、理由（再発行）を出す', !r.ordered && /再発行/.test(oKey), oKey)
await t.press('3'); await t.goto(Y); await t.colKey('ordered'); await t.press('Enter'); await page.waitForTimeout(100); const chk = await t.toast(); p = await t.proj(); r = p.rows.find((x) => x.id === Y); log('3 ordered Enter →', chk, r.ordered)
check('G2-2 3 発注・入荷 の「発注」列の Enter でも止まる', !r.ordered, chk)
if (r.ordered) { await t.press('Control+z'); await page.waitForTimeout(80) }
await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); const rec = await t.toast(); p = await t.proj(); r = p.rows.find((x) => x.id === Y); log('3 received Enter →', rec, r.ordered, r.received)
check('G2-3 「入荷」列の Enter（発注を飛ばした入荷）でも止まる', !r.ordered && !r.received, rec)
if (r.received) { await t.press('Control+z'); await page.waitForTimeout(80) }
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(`${Y} 発注`); await page.waitForTimeout(150)
const pal = await page.getByTestId('palette-list').locator('.item').allTextContents(); log('palette', JSON.stringify(pal.slice(0, 3)))
await page.keyboard.press('Enter'); await page.waitForTimeout(120); const pmsg = await t.toast(); p = await t.proj(); r = p.rows.find((x) => x.id === Y); log('palette order →', pmsg, r.ordered)
check('G2-4 パレットの「発注」でも止まる', !r.ordered, pmsg)
if (r.ordered) { await t.press('Control+z'); await page.waitForTimeout(80) }
// 再発行 → 回答 → 発注できる
const n0 = t.downloads.length; log('formal again →', await t.requestFormal())
p = await t.proj(); log('after formal again', h.show(p, Y), '|', await h.status(Y))
const rY = p.rows.find((x) => x.id === Y); const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === rY.adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
const o2 = await t.order(Y); p = await t.proj(); r = p.rows.find((x) => x.id === Y); log('order after reissue →', o2, h.show(p, Y))
check('G2-5 再発行して回答を入れたら発注できる', r.ordered === true, o2)
// (2) 案件納期の変更（必要日だけ）→ 再発行対象 → 発注止め → 差分シート
await t.role('pm'); const due0 = (await t.proj()).dueDate
const due1 = new Date(new Date(due0).getTime() - 5 * 86400000).toISOString().slice(0, 10)
log('PM dueDate', due0, '→', due1, await h.setting('dueDate', due1, '客先の前倒し'))
p = await t.proj(); for (const id of [W, V]) log('after due change', h.show(p, id), '|', await h.status(id))
await t.role('purchasing'); await t.press('8'); const ow = await t.order(W); p = await t.proj(); r = p.rows.find((x) => x.id === W); log('order W →', ow, r.ordered)
check('G2-6 案件納期の変更で再発行対象になった正式見積済の行は、再発行まで発注できない（理由を出す）', !r.ordered && /再発行/.test(ow), ow)
const n1 = t.downloads.length; log('formal (reissue) →', await t.requestFormal())
const sheets = []
for (const dl of t.downloads.slice(n1)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((rr) => rows.push(JSON.stringify(rr.values))); sheets.push({ f: dl.suggested, sh: sh.name, rows }) }) }
const diffW = sheets.filter((s) => s.sh === '差分').flatMap((s) => s.rows).filter((x) => x.includes(W))
log('差分 sheets', JSON.stringify(sheets.filter((s) => s.sh === '差分').map((s) => [s.f, s.rows.slice(0, 6)])))
check('G2-7 再発行の依頼書の差分シートに W の必要納期（旧 → 新）が出る', diffW.some((x) => x.includes('必要納期')), JSON.stringify(diffW))
// (3) 古いデータ: 発注済の行に再発行の印が残ったまま → 読み込みで外れる
const ws = await t.ws(); const pj = ws.projects.find((x) => x.id === ws.currentProjectId); const rr = pj.rows.find((x) => x.id === Y); rr.flags.reissue = true
await t.open('purchasing', ws); const fl = await t.S(`return p.rows.find((x) => x.id === '${Y}').flags`); const stL = await h.status(Y)
log('legacy store flags', JSON.stringify(fl), '|', stL, 'ball', await h.ballOf(Y))
check('G2-8 発注済の行に残った再発行の印は読み込みで外れる（購買のボールに残らない）', !fl.reissue && !/再発行/.test(stL), JSON.stringify(fl) + ' ' + stL)
await t.shot('g2')
summary(); await t.close()
