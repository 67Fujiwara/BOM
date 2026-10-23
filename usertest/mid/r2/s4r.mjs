import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('pm')
const dls = []
page.on('download', (d) => dls.push(d.suggestedFilename()))
// PM: 予算を上げて（予算比の上長決裁を外す）
await t.cmd('案件設定'); await page.waitForTimeout(80)
const fields = await page.getByTestId('settings').textContent(); log('settings panel:', fields.slice(0, 300))
for (let i = 0; i < 3; i++) await t.press('ArrowDown') // budget
await t.press('Enter'); await page.getByTestId('settings-input').fill('100000000'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80)
log('settings save dialog:', (await t.dialog()).slice(0, 80)); await page.getByTestId('prompt-text').fill('テストのため予算を上げる'); await t.press('Enter'); await page.waitForTimeout(80)
log('budget now', (await t.proj()).settings.budget, 'toast', await t.toast())
// 設計: R002 を作業中に、R001 を一括採用前提でそのまま
await t.role('design'); await t.setCell('R002', '備考', '作業中メモ')
// 設計: 未採用を一括採用（見積済 → 選定済を増やす）
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(200); log('bulk →', await t.toast())
// 購買: 正式見積を依頼
await t.role('purchasing')
await t.cmd('正式見積を依頼（社外）', '正式見積'); await page.waitForTimeout(80)
const conf = await t.dialog(); log('formal confirm:', conf)
await t.press('2'); await page.waitForTimeout(1500)
log('formal →', await t.toast(), 'downloads:', dls.length, dls.slice(0, 3))
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested').map((r) => r.id)
log('formalRequested:', fr.length, 'R002:', p.rows.find((r) => r.id === 'R002').status, 'contested in fr:', p.rows.filter((r) => r.flags.contested && r.status === 'formalRequested').length)
check('S4 正式見積依頼で作業中 R002 は除外', p.rows.find((r) => r.id === 'R002').status === 'selected')
check('S4 確認ダイアログ/結果に拮抗 n 行を含む旨', /拮抗/.test(conf + (await t.toast())), conf)
// 8 で正式単価
await t.press('8')
log('view8 cols:', (await page.locator('thead th').allTextContents()).join('|'))
const qOf = (id) => { const r = p.rows.find((x) => x.id === id); return { r, q: p.quotes.find((q) => q.rowId === id && q.supplierId === r.adoptedSupplierId && !q.stale) } }
const a = qOf('R001'); log('R001', a.r.adoptedSupplierId, a.q.unitPrice, 'oq', a.r.orderQty)
// +16% だが金額差 < ¥10,000 → 仕様（大きい方）では閾値内
await t.setCellKey('R001', 'q.formalPrice@A', String(Math.round(a.q.unitPrice * 1.16)))
let r1 = await t.row('R001'); log('R001 after +16%:', r1.status, JSON.stringify(r1.flags))
check('S4 正式単価 +16%・差額 ¥' + Math.round(a.q.unitPrice * 0.16) * (r1.orderQty ?? 1) + '（¥10,000 未満）は閾値内（大きい方）で正式見積済', r1.status === 'formalQuoted' && !r1.flags.formalDiff)
// R003: 差額 > ¥10,000 かつ > 10%
const b = qOf('R003'); const big3 = b.q.unitPrice + Math.ceil(12000 / (b.r.orderQty ?? b.r.qtyNeeded))
await t.setCellKey('R003', 'q.formalPrice@A', String(big3)); await t.setCellKey('R003', 'q.formalLeadDays@A', '5')
log('R003 after big:', (await t.row('R003')).status, JSON.stringify((await t.row('R003')).flags), 'ball', await t.cell('R003', 'ball').catch(() => '-'))
// 別の 2 行も差分超過に（d, q, b 用）
const others = fr.filter((x) => !['R001', 'R003'].includes(x)).slice(0, 4)
for (const id of others) { const o = qOf(id); await t.setCellKey(id, 'q.formalPrice@A', String(o.q.unitPrice + Math.ceil(15000 / (o.r.orderQty ?? o.r.qtyNeeded)))) }
log('others', others, (await t.proj()).rows.filter((r) => others.includes(r.id)).map((r) => r.id + ':' + r.status + ':' + (r.flags.formalDiff ? 'diff' : '')))
await t.shot('s4-view8')
// 発注: 差分超過（PM 未決定）の行を o で発注できてしまうか
await t.press('3'); await t.goto(others[3]); await t.press('o'); await page.waitForTimeout(50)
log('o on 差分超過', others[3], '→', await t.toast(), (await t.row(others[3])).status)
check('S4 差分超過（PM 未決定）の行は発注できない', (await t.row(others[3])).status !== 'ordered')
// PM
await t.role('pm'); await t.press('7')
const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('PM 7:', v7.join(','))
await t.goto('R003'); await t.press('Enter'); log('panel 差分超過:', await page.getByTestId('quickfix').textContent()); await t.press('Escape')
// g 再交渉
await t.goto('R003'); await t.press('Enter'); await t.press('g'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('再交渉して'); await t.press('Enter'); await page.waitForTimeout(80)
let r3 = await t.row('R003'); log('g →', await t.toast(), r3.status, JSON.stringify(r3.flags), 'dueAt', r3.dueAt)
check('S4 g 再交渉 → 正式依頼中（購買）で 7 から外れる', r3.status === 'formalRequested' && !r3.flags.formalDiff, `${r3.status} formalDiff=${r3.flags.formalDiff}`)
// d 設計へ代替依頼
const dId = others[0]
await t.goto(dId); await t.press('Enter'); await t.press('d'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('安い代替を'); await t.press('Enter'); await page.waitForTimeout(80)
p = await t.proj(); let rd = p.rows.find((r) => r.id === dId)
log('d →', await t.toast(), rd.status, JSON.stringify(rd.flags), 'issues:', p.issues.filter((i) => i.rowId === dId).map((i) => i.kind + ':' + i.status))
check('S4 d → コスト超過が起票され、行は設計のボール（7 から外れる）', p.issues.some((i) => i.rowId === dId && i.kind === 'コスト超過') && !rd.flags.formalDiff, JSON.stringify(rd.flags))
// q 数量見直し
const qId = others[1]
await t.goto(qId); await t.press('Enter'); await t.press('q'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill(''); await t.press('Enter'); await page.waitForTimeout(80)
p = await t.proj(); const rq = p.rows.find((r) => r.id === qId)
log('q →', await t.toast(), rq.status, JSON.stringify(rq.flags), 'issues:', p.issues.filter((i) => i.rowId === qId).map((i) => i.kind + ':' + i.status + ':' + i.text))
// b 次点
const bId = others[2]
await t.goto(bId); const before = (await t.row(bId)).adoptedSupplierId; await t.press('Enter'); await t.press('b'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill(''); await t.press('Enter'); await page.waitForTimeout(80)
const rb = await t.row(bId); log('b →', await t.toast(), before, '→', rb.adoptedSupplierId, rb.status, JSON.stringify(rb.flags))
// 受入（差額 < 30万 → 上長決裁なし）
await t.goto(others[3]).catch(() => {}); 
// 設計が「代替なし」で回答 → 対策不成立で 7 に
await t.role('design'); await t.press('1'); await t.goto(dId); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50)
const ap = await page.getByTestId('quickfix').textContent(); log('design issue panel (コスト超過):', ap)
const opts = await page.getByTestId('quickfix').locator('.opt, [role=option], div').allTextContents()
// 代替なし の項目まで ↓
const labels = ap.split(/(?=\d \d )/)
let n = 0; for (const l of ['1 返信', '2 直さず', '3 客先', '4 提案']) if (ap.includes(l)) n++
for (let i = 0; i < n; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.waitForTimeout(50); log('dlg:', (await t.dialog()).slice(0, 60)); await page.getByTestId('prompt-text').fill('同等品なし'); await t.press('Enter'); await page.waitForTimeout(80)
rd = await t.row(dId); log('after 代替なし:', rd.status, JSON.stringify(rd.flags))
await t.role('pm'); await t.press('7'); await t.goto(dId); await t.press('Enter'); const pn = await page.getByTestId('quickfix').textContent().catch(() => 'no panel'); log('PM panel after 対策不成立:', pn); await t.press('Escape')
check('S4 対策不成立の決定パネルは 受入 / b / g / e（d・q なし）', /受入/.test(pn) && /e /.test(pn) && !/q 数量/.test(pn), pn)
// 上長決裁: 差額 ≥ ¥300,000
await t.role('purchasing'); await t.press('8')
const big = fr.find((x) => ![...others, 'R001', 'R003'].includes(x))
const g = qOf(big); await t.setCellKey(big, 'q.formalPrice@A', String(g.q.unitPrice + Math.ceil(400000 / (g.r.orderQty ?? g.r.qtyNeeded))))
await t.role('pm'); await t.press('7'); await t.goto(big); await t.press('y'); await page.waitForTimeout(60)
log('y dialog (上長決裁):', await t.dialog())
if (await page.getByTestId('extra-承認者').count()) { await page.getByTestId('extra-承認者').fill('部長'); await page.getByTestId('extra-決裁書No').fill('K-9'); await page.getByTestId('prompt-text').fill('受入'); await t.press('Enter'); await page.waitForTimeout(80) }
const rbig = await t.row(big); log('受入(上長決裁) →', await t.toast(), rbig.status, JSON.stringify(rbig.flags))
check('S4 上長決裁の入力を入れれば受入できる', !rbig.flags.formalDiff, await t.toast())
// 受入（決裁不要）
const small = others[3]
await t.goto(small); await t.press('y'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('受入'); await t.press('Enter'); await page.waitForTimeout(80)
log('受入 small →', await t.toast(), JSON.stringify((await t.row(small)).flags), (await t.row(small)).status)
// 発注・入荷
await t.role('purchasing'); await t.press('3')
await t.goto(small); await t.press('o'); await page.waitForTimeout(40); log('o formalQuoted →', await t.toast(), (await t.row(small)).status)
await t.press('i'); await page.waitForTimeout(40); log('i →', await t.toast(), (await t.row(small)).status)
p = await t.proj(); const sel = p.rows.find((r) => r.status === 'selected' && !r.flags.early)
await t.goto(sel.id); await t.press('o'); await page.waitForTimeout(40); log('o selected', sel.id, '→', await t.toast(), (await t.row(sel.id)).status)
check('S4 選定済（正式見積前）は発注不可', (await t.row(sel.id)).status === 'selected')
// 設計列ロック
await t.role('design'); await t.setCell(small, '型式', 'XXX'); log('design edit on received row →', await t.toast())
log('header money:', await t.money())
await t.shot('s4-end')
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
