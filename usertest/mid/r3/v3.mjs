// v3: 選定 → 正式見積 → 差分超過の PM 決定 → 対策不成立 → 発注ガード
// 再検証: M-01, M-06, M-08, M-16, M-17, M-32, M-34, U-03 ／ 新規: 入荷での発注ガード迂回、d/q 後の発注
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(300); log('bulk →', await t.toast())
let p = await t.proj()
log('money', await t.money(), 'contested', p.rows.filter((r) => r.flags.contested).length, 'pending', p.rows.filter((r) => r.flags.pmPending).map((r) => r.id))
await t.press('1'); log(await t.setCellKey('R002', 'note', '作業中メモ'))
// 購買: 正式見積を依頼
await t.role('purchasing')
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100)
let pn = await t.panel(); log('formal confirm:', pn?.title)
const cand = p.rows.filter((r) => r.adoptedSupplierId && r.status === 'selected' && !r.flags.pmPending && !r.flags.ltbPending)
log('expected n (excluding R002 working):', cand.filter((r) => r.id !== 'R002').length, 'contested', cand.filter((r) => r.flags.contested && r.id !== 'R002').length)
check('M-32 確認に「拮抗 n 行を含む」と除外後の件数', /拮抗 \d+ 行を含む/.test(pn?.title ?? '') && (pn?.title ?? '').includes(`対象 ${cand.filter((r) => r.id !== 'R002').length} 行`), pn?.title)
await t.press('2'); await page.waitForTimeout(1500); log('formal →', await t.toast(), 'downloads', t.downloads.length)
p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested')
log('formalRequested', fr.length, 'R002', p.rows.find((r) => r.id === 'R002').status, 'dueAt sample', fr[0]?.dueAt)
// 依頼書の回答期限（暦日か営業日か）
await page.waitForTimeout(500)
const dl = t.downloads.at(-1)
if (dl) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]
  const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1).join('|'))); log('formal request xlsx head:', rows.slice(0, 7))
  const ddl = rows.find((r) => r.startsWith('回答期限'))?.split('|')[1]
  check('M-34 正式見積依頼書の回答期限が営業日（行の期限と同じ）', ddl === fr[0]?.dueAt, `excel=${ddl} row.dueAt=${fr[0]?.dueAt}`)
}
// 8 で正式単価
await t.press('8')
const qOf = (id) => { const r = p.rows.find((x) => x.id === id); return { r, q: p.quotes.find((q) => q.rowId === id && q.supplierId === r.adoptedSupplierId && !q.stale) } }
const a1 = qOf('R001'); const oq = (r) => r.orderQty ?? r.qtyNeeded
log('R001', a1.q.unitPrice, oq(a1.r))
log(await t.setCellKey('R001', 'q.formalPrice@A', String(Math.round(a1.q.unitPrice * 1.16))))
let r = await t.row('R001'); check('M-16 +16% でも差額 ¥10,000 未満は閾値内で正式見積済', r.status === 'formalQuoted' && !r.flags.formalDiff, JSON.stringify({ s: r.status, f: r.flags.formalDiff, diff: Math.round(a1.q.unitPrice * 0.16) * oq(a1.r) }))
// 差分超過を作る行（金額の大きい順）
const big = fr.filter((x) => x.id !== 'R001').map((x) => ({ id: x.id, ...qOf(x.id) })).sort((a, b) => b.q.unitPrice * oq(b.r) - a.q.unitPrice * oq(a.r))
const ids = big.slice(0, 8).map((x) => x.id)
log('diff rows', ids.map((id) => { const o = qOf(id); return `${id}:${o.q.unitPrice}x${oq(o.r)}` }).join(' '))
// ids[0]: 差額 ≥ ¥300,000（上長決裁）。他は差額 ¥15,000 程度
const ext = ids[0]; const e0 = qOf(ext)
log(await t.setCellKey(ext, 'q.formalPrice@A', String(Math.round(e0.q.unitPrice * 1.25))))
for (const id of ids.slice(1)) { const o = qOf(id); log(id, await t.setCellKey(id, 'q.formalPrice@A', String(Math.round(o.q.unitPrice * 1.25)))) }
// 8 の数値セルで「3」を押す（3 発注・入荷へ移るつもり）→ Ctrl+G で別の行へ
const lastId = ids.at(-1); const lastBefore = (await t.quotes(lastId)).find((q) => q.supplierId === qOf(lastId).r.adoptedSupplierId && !q.stale).formalPrice
await t.press('3'); await page.waitForTimeout(60); const v8 = await t.view(); const m8 = await t.mode()
await t.goto('R010'); await page.waitForTimeout(60)
const lastAfter = (await t.quotes(lastId)).find((q) => q.supplierId === qOf(lastId).r.adoptedSupplierId && !q.stale).formalPrice
log('press 3 in view8 → view', v8, 'mode', m8, lastId, 'formalPrice', lastBefore, '→', lastAfter)
check('U3 8 正式見積で数字キー 3 がビュー切替にならず、続く Ctrl+G で正式単価が 3 に上書きされない', lastAfter === lastBefore, `view=${v8} mode=${m8} ${lastBefore}→${lastAfter}`)
await t.shot('v3-digit-overwrite')
if (lastAfter !== lastBefore) { await t.press('Control+z'); await page.waitForTimeout(60) }
await t.press('Escape')
p = await t.proj(); log('diff flags', ids.map((id) => id + ':' + p.rows.find((x) => x.id === id).status + ':' + (p.rows.find((x) => x.id === id).flags.formalDiff ? 'DIFF' : '-')).join(' '))
const [idG, idD, idQ, idB, idO, idI] = ids.slice(1)
// M-08: 差分超過の行は o で発注できない / 新規: i（入荷）でも発注できない
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(idO); await t.press('o'); await page.waitForTimeout(60); log('o on diff', idO, '→', await t.toast())
check('M-08 差分超過（PM 未決定）の行は o で発注できない', !(await t.row(idO)).ordered)
await t.goto(idI); await t.colKey('received'); await t.press('i'); await page.waitForTimeout(60); log('i on diff', idI, '→', await t.toast())
r = await t.row(idI); log(idI, 'after i:', r.status, r.ordered, r.received, JSON.stringify(r.flags))
check('M3 差分超過（PM 未決定）の行を i（入荷）で発注済・入荷済にできない', !r.received && !r.ordered, `${r.status} ordered=${r.ordered} received=${r.received}`)
await t.shot('v3-received-bypass')

// PM
await t.role('pm'); await t.press('7')
log('PM 7 rows:', (await t.viewRows()).join(','))
// U-03 / M-01: 上長決裁の受入
await t.goto(ext); await t.press('y'); await page.waitForTimeout(60); pn = await t.panel(); log('y on ext:', JSON.stringify(pn))
await t.promptFill('為替で上昇。受入'); await t.press('Enter'); await page.waitForTimeout(60)
pn = await t.panel(); log('after Enter w/o approver:', JSON.stringify(pn)?.slice(0, 200), 'toast', await t.toast())
check('U-03 上長決裁の入力が無いエラーでダイアログと理由が残る', pn?.kind === 'prompt' && (await page.getByTestId('prompt-text').inputValue()) === '為替で上昇。受入')
if (pn) { await t.extraFill('承認者', '部長 田中'); await t.extraFill('決裁書No', 'K-001'); await page.getByTestId('extra-決裁書No').press('Enter'); await page.waitForTimeout(80) }
r = await t.row(ext); p = await t.proj(); const dec = p.decisions.filter((d) => d.rowId === ext).at(-1)
log(ext, 'after 受入:', r.status, JSON.stringify(r.flags), JSON.stringify(dec))
check('M-01 上長決裁の承認者・決裁書 No. が決定に記録され受入できる', !r.flags.formalDiff && dec?.external?.approver === '部長 田中' && dec?.external?.ref === 'K-001')
// 決定パネル: g
async function decide(id, key, text = '') {
  await t.goto(id); await t.press('Enter'); await page.waitForTimeout(60); const panel = await t.panel()
  await t.press(key); await page.waitForTimeout(60); const pr = await t.panel()
  if (pr?.kind === 'prompt') { if (text) await t.promptFill(text); await t.press('Enter'); await page.waitForTimeout(80) }
  return { panel, after: await t.panel(), toast: await t.toast() }
}
let res = await decide(idG, 'g', '再交渉してください'); log('panel', JSON.stringify(res.panel?.options)); r = await t.row(idG)
log('g →', res.toast, r.status, JSON.stringify(r.flags), 'ball', await t.cellText(idG, 'ball'), 'due', r.dueAt)
check('M-06g g 再交渉 → 正式依頼中・購買（7 から外れる）', r.status === 'formalRequested' && !r.flags.formalDiff && (await t.cellText(idG, 'ball')) === '購買')
res = await decide(idD, 'd', '安価な代替を'); r = await t.row(idD); p = await t.proj()
log('d →', res.toast, r.status, JSON.stringify(r.flags), p.issues.filter((i) => i.rowId === idD).map((i) => `${i.kind}:${i.status}:${i.dueAt}`))
check('M-06d d → コスト超過を起票・設計のボール・7 から外れる', p.issues.some((i) => i.rowId === idD && i.kind === 'コスト超過') && !r.flags.formalDiff && (await t.cellText(idD, 'ball')) === '設計')
res = await decide(idQ, 'q', ''); r = await t.row(idQ); p = await t.proj()
log('q →', res.toast, r.status, JSON.stringify(r.flags), p.issues.filter((i) => i.rowId === idQ).map((i) => `${i.kind}:${i.status}:${i.text}:${i.dueAt}`))
check('M-06q q → 数量見直し依頼・設計のボール', p.issues.some((i) => i.rowId === idQ && i.kind === '数量見直し依頼') && !r.flags.formalDiff)
const bBefore = (await t.row(idB)).adoptedSupplierId
res = await decide(idB, 'b'); r = await t.row(idB); log('b →', res.toast, bBefore, '→', r.adoptedSupplierId, r.status, JSON.stringify(r.flags))
// 新規: d/q の後、PM が価格を受け入れていないのに購買が発注できるか
await t.role('purchasing'); await t.press('3'); log('view', await t.view())
for (const id of [idD, idQ]) { await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); const rr = await t.row(id); log('o on', id, '→', await t.toast(), rr.status) }
const ordD = (await t.row(idD)).ordered, ordQ = (await t.row(idQ)).ordered
check('M3 d（代替依頼）/ q（数量見直し）の後、PM の受入なしに差分超過の価格で発注できない', !ordD && !ordQ, `ordered d=${ordD} q=${ordQ}`)
if (ordD) { await t.goto(idD); await t.press('o'); await page.waitForTimeout(60) }
// 設計: d の行に「代替なし」→ 対策不成立
await t.role('design'); await t.press('1'); await t.goto(idD); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(60)
pn = await t.panel(); log('design issue panel:', JSON.stringify(pn?.options))
await t.press('7'); await page.waitForTimeout(60); await t.promptFill('代替品なし'); await t.press('Enter'); await page.waitForTimeout(80); await t.press('Escape')
r = await t.row(idD); log(idD, 'after 代替なし:', r.status, JSON.stringify(r.flags))
await t.role('pm'); await t.press('7'); await t.goto(idD); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('PM panel 対策不成立:', pn?.title, JSON.stringify(pn?.options)); await t.press('Escape')
check('M-17 対策不成立は専用の種別で 受入 / b / g / e', /対策不成立/.test(pn?.title ?? '') && ['Shift+Y', 'b ', 'g ', 'e '].every((k) => (pn?.options ?? []).some((o) => o.startsWith(k))))
// 対策不成立 → 受入 → 発注
res = await decide(idD, 'Shift+Y', '価格受入'); r = await t.row(idD); log('受入 →', res.toast, JSON.stringify(r.flags))
// Undo: PM が決定を Ctrl+Z
await t.press('Control+z'); await page.waitForTimeout(80); log('PM Ctrl+Z →', await t.toast()); r = await t.row(idD); log(idD, 'after undo', JSON.stringify(r.flags))
await t.press('Control+y'); await page.waitForTimeout(60)
await t.shot('v3-pm7')
summary(); await t.close()
