import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const detailRows = async () => page.locator('[data-testid="detail"] table.quotes tbody tr').allTextContents()
// --- スコアの基準日: R020 の内訳
await t.goto('R020'); await t.press(' ')
const d20 = await page.getByTestId('detail').textContent()
log('R020 head:', d20.slice(0, 60))
log('R020 rows:', await detailRows())
const r20 = (await t.row('R020'))
log('R020 quotedAt', r20.quotedAt, 'today', new Date().toISOString().slice(0, 10))
await t.press('Escape')
// --- 納期スコア: 余裕 >= 0 で 100 のはず（R001 因幡 受注生産 19 日、必要日 11/10）
await t.goto('R001'); await t.press(' ')
log('R001 rows before:', await detailRows())
await t.press('Escape')
// --- 採用後にスコアが変わるか（基準数量が必要数ではなく発注数）: R004 で MOQ>必要数 の商社を Shift+A で選ぶ
p = await t.proj()
let moqRow = null
for (const r of p.rows.filter((r) => r.status === 'quoted')) { const qs = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice && q.moq && q.moq > r.qtyNeeded); if (qs.length) { moqRow = { r, q: qs[0] }; break } }
log('moqRow', moqRow?.r.id, moqRow?.q.supplierId, 'moq', moqRow?.q.moq, 'qty', moqRow?.r.qtyNeeded)
if (moqRow) {
  const id = moqRow.r.id
  await t.goto(id); await t.press(' '); const before = await detailRows(); log(id, 'before:', before); await t.press('Escape')
  await t.goto(id); await t.press('Shift+A')
  const opts = await page.getByTestId('adopt').locator('.opt').allTextContents(); log('adopt opts', opts)
  const supName = (await t.ws()).suppliers.find((s) => s.id === moqRow.q.supplierId).name
  const idx = opts.findIndex((o) => o.includes(supName))
  await t.press(String(idx + 1)); await page.waitForTimeout(60)
  const dlg = await t.dialog(); log('dialog after pick:', dlg.slice(0, 80))
  if (/理由/.test(dlg)) { await t.press('1'); await page.waitForTimeout(40); log('after pressing 1 in reason prompt: text=', await page.getByTestId('prompt-text').inputValue().catch(() => '-')); await page.getByTestId('prompt-text').fill(''); await t.press('Enter') }
  await page.waitForTimeout(60)
  log('toast:', await t.toast(), 'row:', JSON.stringify(await t.row(id).then((r) => ({ s: r.status, a: r.adoptedSupplierId, oq: r.orderQty, reason: r.adoptReason, flags: r.flags }))))
  await t.goto(id); await t.press(' '); const after = await detailRows(); log(id, 'after:', after); await t.press('Escape')
  check('S3 採用後もスコア内訳（基準数量＝必要数）が変わらない', JSON.stringify(before.map((x) => x.replace(/採用.*/, ''))) === JSON.stringify(after.map((x) => x.replace(/採用.*/, ''))), `before=${before.join(' / ')} after=${after.join(' / ')}`)
  await t.shot('s3-score-after-adopt')
}
// --- 閾値超の例外選定 → PM承認待ち → y（上長決裁？）
p = await t.proj()
let big = null
for (const r of p.rows.filter((r) => r.status === 'quoted' && !r.adoptedSupplierId && r.qtyNeeded > 0)) {
  await t.goto(r.id); await t.press('Shift+A')
  const opts = await page.getByTestId('adopt').locator('.opt').allTextContents()
  const parsed = opts.map((o) => ({ price: Number((o.match(/¥([\d,]+)/)?.[1] ?? '0').replace(/,/g, '')), score: Number(o.match(/スコア ([\d.]+)/)?.[1] ?? 0) }))
  let idx = -1
  for (let i = 1; i < parsed.length; i++) { const d = (parsed[i].price - parsed[0].price) * r.qtyNeeded; const pct = (parsed[i].price - parsed[0].price) / parsed[0].price; if (parsed[0].score - parsed[i].score > 5 && d > 10000 && pct > 0.03) { idx = i; break } }
  if (idx < 0) { await t.press('Escape'); continue }
  log('big candidate', r.id, opts)
  await t.press(String(idx + 1)); await page.waitForTimeout(50); await t.press('ArrowDown', 'ArrowDown', 'ArrowDown'); await t.press('Enter'); await page.waitForTimeout(50)
  big = r.id; break
}
log('big →', await t.toast(), 'status:', await t.cell(big, 'status'), 'ball', await t.cell(big, 'ball'), 'reason', (await t.row(big)).adoptReason)
check('S3 閾値超の例外選定は PM承認待ち・PM ボール', /PM承認待ち/.test(await t.cell(big, 'status')) && (await t.cell(big, 'ball')) === 'PM')
await t.role('pm'); await t.press('7')
const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('PM 7:', v7.join(','))
await t.goto(big); await t.press('Enter'); log('decision panel 例外選定:', await page.getByTestId('quickfix').textContent()); await t.press('Escape')
await t.goto(big); await t.press('y'); await page.waitForTimeout(60)
const yd = await t.dialog(); log('y dialog:', yd)
const tot = await t.money(); log('money:', tot)
await page.getByTestId('prompt-text').fill('納期優先で承認')
if (await page.getByTestId('extra-承認者').count()) { log('extra fields present'); await t.press('Enter'); await page.waitForTimeout(40); log('Enter w/o approver →', await t.toast(), '| dialog still open?', !!(await t.dialog())); if (!(await t.dialog())) { await t.goto(big); await t.press('y'); await page.waitForTimeout(60); await page.getByTestId('prompt-text').fill('納期優先で承認') } await page.getByTestId('extra-承認者').fill('部長 田中'); await page.getByTestId('extra-決裁書No').fill('K-1') }
await t.press('Enter'); await page.waitForTimeout(60)
log('after y →', await t.toast(), 'row', JSON.stringify(await t.row(big).then((r) => ({ s: r.status, f: r.flags }))), 'decision:', JSON.stringify((await t.proj()).decisions.at(-1)))
check('S3 PM y で選定済', (await t.row(big)).status === 'selected')
await t.shot('s3-pm-approve')
// --- 先行採用（見積中の行に Alt+A）: R076 を公開→依頼→1社回答
await t.role('design'); await t.press('Control+Enter'); await page.waitForTimeout(80)
let dl = await t.dialog(); if (/Rev/.test(dl)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('design publish drafts →', await t.toast())
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.getByTestId('prompt-text').fill(''); await Promise.all([page.waitForEvent('download', { timeout: 4000 }).catch(() => null), t.press('Enter')]); await page.waitForTimeout(400)
log('request →', await t.toast())
p = await t.proj(); const qrow = p.rows.find((r) => r.status === 'quoting')
log('quoting rows:', p.rows.filter((r) => r.status === 'quoting').map((r) => r.id).join(','))
if (qrow) {
  await t.press('6'); await t.setCellKey(qrow.id, 'q.unitPrice@S1', '5000'); await t.setCellKey(qrow.id, 'q.leadDays@S1', '10')
  log(qrow.id, 'status cell:', await t.cell(qrow.id, 'status'))
  await t.role('design'); await t.goto(qrow.id); await t.press('a'); await page.waitForTimeout(40); log('a on quoting →', await t.toast(), '| status bar:', (await t.status()).slice(0, 120))
  await t.press('Alt+a'); await page.waitForTimeout(60); log('Alt+A quoting dialog:', (await t.dialog()).slice(0, 80))
  await t.press('Enter'); await page.waitForTimeout(60)
  log('先行採用 →', await t.toast(), JSON.stringify(await t.row(qrow.id).then((r) => ({ s: r.status, a: r.adoptedSupplierId, f: r.flags }))))
  await t.role('pm'); await t.press('7'); await t.goto(qrow.id); await t.press('Enter'); log('panel 先行採用:', await page.getByTestId('quickfix').textContent().catch(() => t.toast())); await t.press('Escape')
  await t.goto(qrow.id); await t.press('y'); await page.waitForTimeout(60); const d = await t.dialog(); log('y dlg:', d.slice(0, 120)); await page.getByTestId('prompt-text').fill('先行許可'); if (await page.getByTestId('extra-承認者').count()) { await page.getByTestId('extra-承認者').fill('部長'); await page.getByTestId('extra-決裁書No').fill('K-2') } await t.press('Enter'); await page.waitForTimeout(60)
  log('先行採用 y →', await t.toast(), JSON.stringify(await t.row(qrow.id).then((r) => ({ s: r.status, a: r.adoptedSupplierId, f: r.flags }))))
  check('S3 先行採用の y で選んだ商社のまま選定済＋先行', (await t.row(qrow.id)).status === 'selected' && (await t.row(qrow.id)).flags.early === true)
}
// --- Alt+A（見積済）
await t.role('design')
p = await t.proj(); const alt = p.rows.find((r) => r.status === 'quoted' && !r.adoptedSupplierId && !r.flags.pmPending)
await t.goto(alt.id); await t.press('Alt+a'); await page.waitForTimeout(60)
log('Alt+A', alt.id, '→', await t.toast(), JSON.stringify(await t.row(alt.id).then((r) => ({ s: r.status, a: r.adoptedSupplierId, reason: r.adoptReason }))))
// --- 一括採用
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(200)
const bulk = await t.toast(); log('bulk →', bulk)
p = await t.proj()
const contested = p.rows.filter((r) => r.flags.contested).map((r) => r.id)
await t.press('4'); const v4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('contested', contested.length, 'in design 4:', contested.filter((x) => v4.includes(x)).length, 'lamps', await t.lamps())
check('S3 拮抗バッジの行がすべて選定者の 4 に出る', contested.every((x) => v4.includes(x)), `${contested.filter((x) => v4.includes(x)).length}/${contested.length}`)
// 拮抗の判定（差がちょうど閾値）
// --- 集約: 試算の整合
await t.goto('R030'); // 作業中にしてから集約
await t.setCell('R030', '備考', '作業中メモ')
p = await t.proj()
const cur = p.rows.filter((r) => ['quoted', 'selected'].includes(r.status)).length
await t.cmd('商社を集約'); await page.waitForTimeout(150)
const cons = await t.dialog(); log('consolidate:', cons.slice(0, 600))
// 自前で現在総額と、案1の総額（全行。カバーできない行は現採用のまま）を計算
await t.press('Escape')
log('header money before:', await t.money())
const pend0 = p.rows.filter((r) => r.flags.pmPending).map((r) => r.id)
await t.cmd('商社を集約'); await page.waitForTimeout(150); await t.press('Enter'); await page.waitForTimeout(200)
log('consolidate →', await t.toast(), 'money after:', await t.money())
p = await t.proj()
const r30 = p.rows.find((r) => r.id === 'R030')
log('R030 (作業中) after consolidate:', r30.adoptedSupplierId, r30.adoptReason, 'pending before:', pend0.join(','), 'their reasons after:', pend0.map((id) => p.rows.find((r) => r.id === id).adoptReason).join(','))
check('S3 集約は作業中●の行を対象外にする', r30.adoptReason !== '集約', r30.adoptReason)
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
