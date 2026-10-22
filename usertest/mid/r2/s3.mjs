import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const today = new Date().toISOString().slice(0, 10)
// R020 の Space 内訳と自前計算の比較
await t.goto('R020'); await t.press(' ')
const detail = await page.getByTestId('detail').textContent()
log('R020 detail:', detail.slice(0, 600))
const r20 = p.rows.find((r) => r.id === 'R020')
const qs = p.quotes.filter((q) => q.rowId === 'R020' && q.unitPrice != null && q.leadDays !== -1)
log('R020 quotes:', qs.map((q) => `${q.supplierId} ¥${q.unitPrice} ${q.leadDays}d moq=${q.moq} ${q.stock}`), 'qty', r20.qtyNeeded, 'need', p.dueDate, p.settings.processDays)
// 仕様の計算: 価格 = 100×最安実質/実質, 実質 = 単価×丸め数量/必要数。納期: 余裕>=0 で 100
// 先行手配品 R023 (needOffset -7) と MOQ ありの行（m 単位 MOQ100）
const moqRow = p.rows.find((r) => p.quotes.some((q) => q.rowId === r.id && q.moq && q.moq > r.qtyNeeded && q.unitPrice))
log('MOQ row:', moqRow?.id, moqRow?.qtyNeeded, p.quotes.filter((q) => q.rowId === moqRow?.id).map((q) => `${q.supplierId}:${q.unitPrice}:moq${q.moq}`))
await t.press('Escape'); await t.goto(moqRow.id); await t.press(' ')
const dm = await page.getByTestId('detail').textContent()
log('MOQ row detail:', dm.slice(0, 500))
await t.shot('s3-01-breakdown')
// パック品で入数 100、必要数 10 → 丸め数量 100 のはず
const pack = p.rows.find((r) => r.unit === 'パック' && r.status === 'quoted')
await t.press('Escape'); await t.goto(pack.id); await t.press(' ')
const dp = await page.getByTestId('detail').textContent()
log('pack row', pack.id, 'qty', pack.qtyNeeded, 'packQty', pack.packQty, 'detail:', dp.slice(0, 400))
check('S3 パック品（入数 100・必要数 ' + pack.qtyNeeded + '）の丸め数量が 100 の倍数で表示', /\b100\b/.test(dp.slice(0, 400)))
// スコアが納期 100 になるか（余裕>=0）: 在庫即納の商社
const stockQ = p.quotes.find((q) => q.stock === '在庫' && q.unitPrice && p.rows.find((r) => r.id === q.rowId)?.status === 'quoted')
await t.press('Escape'); await t.goto(stockQ.rowId); await t.press(' ')
const ds = await page.locator('[data-testid="detail"] table.quotes tbody tr').allTextContents()
log('stock row', stockQ.rowId, 'quotes rows:', ds)
const stockLine = ds.find((l) => /即納/.test(l))
log('即納 line:', stockLine)
await t.press('Escape')

// ---- a 推奨
await t.goto('R020'); await t.press('a'); await page.waitForTimeout(50)
log('a →', await t.toast(), 'status:', await t.cell('R020', 'status'), 'adopted:', await t.cell('R020', 'adopted'))
check('S3 a で選定済', /選定済/.test(await t.cell('R020', 'status')))
const r20b = await t.row('R020')
log('R020 orderQty', r20b.orderQty, 'score', r20b.scoreSnapshot)
// ---- Shift+A で 2 位
await t.goto('R021'); await t.press('Shift+A')
const adoptTxt = await page.getByTestId('adopt').textContent()
log('adopt panel R021:', adoptTxt)
await t.press('2')
await page.waitForTimeout(50)
log('after 2:', await page.locator('[role=dialog]').textContent().catch(() => ''))
await t.press('1')
await page.waitForTimeout(50)
log('Shift+A 2位 →', await t.toast(), 'status:', await t.cell('R021', 'status'))
// 閾値超の行を探す: 1位と最下位の差が大きい行
let big = null
for (const r of p.rows.filter((r) => r.status === 'quoted')) {
  const sc = p.quotes.filter((q) => q.rowId === r.id && q.unitPrice).sort((a, b) => a.unitPrice - b.unitPrice)
  if (sc.length >= 2 && (sc.at(-1).unitPrice - sc[0].unitPrice) * r.qtyNeeded > 12000) { big = r; break }
}
log('big diff row:', big?.id)
await t.goto(big.id); await t.press('Shift+A')
const n = await page.getByTestId('adopt').locator('.opt').count()
log('adopt opts:', await page.getByTestId('adopt').textContent())
await t.press(String(n)); await page.waitForTimeout(50); await t.press('3'); await page.waitForTimeout(50)
log('Shift+A 最下位 →', await t.toast(), 'status:', await t.cell(big.id, 'status'), 'ball:', await t.cell(big.id, 'ball'))
check('S3 閾値超の例外選定は PM承認待ち', /PM承認待ち/.test(await t.cell(big.id, 'status')))
// ---- Alt+A
await t.goto('R024'); await t.press('Alt+a'); await page.waitForTimeout(50)
log('Alt+A →', await t.toast(), 'status:', await t.cell('R024', 'status'), 'adopted:', await t.cell('R024', 'adopted'))
check('S3 Alt+A 最安で採用', /選定済|PM承認待ち/.test(await t.cell('R024', 'status')))
// 見積中の行に Alt+A（先行採用）
const quoting = (await t.proj()).rows.find((r) => r.status === 'quoting')
log('quoting row:', quoting?.id)
if (quoting) { await t.goto(quoting.id); await t.press('Alt+a'); await page.waitForTimeout(50); log('Alt+A on quoting:', await page.locator('[role=dialog]').textContent().catch(() => ''), await t.toast()); await t.press('1'); await page.waitForTimeout(50); log('→', await t.toast(), await t.cell(quoting.id, 'status')) }
// ---- w 行の重み
await t.goto('R025'); await t.press('w')
log('weights panel:', await page.locator('[role=dialog]').textContent())
await t.press('ArrowRight', 'ArrowRight'); log('after →→:', await page.locator('[role=dialog]').textContent())
await t.press('Escape')
p = await t.proj(); log('rowWeights R025:', JSON.stringify(p.rowWeights['R025']))
check('S3 w で行の重みが変わる', p.rowWeights['R025']?.price === 50)
// ---- 一括採用
await t.press('Control+k'); await page.getByTestId('palette-input').fill('一括採用'); await page.waitForTimeout(50)
log('palette:', (await page.getByTestId('palette-list').textContent()).slice(0, 200))
await t.press('Enter'); await page.waitForTimeout(300)
const bulk = await t.toast()
log('bulk →', bulk)
check('S3 一括採用の結果サマリ（採用/拮抗/承認要/スキップ）', /採用 \d+ \/ 拮抗 \d+/.test(bulk), bulk)
p = await t.proj()
const contested = p.rows.filter((r) => r.flags.contested)
log('contested rows:', contested.map((r) => r.id).join(','), 'pending:', p.rows.filter((r) => r.flags.pmPending).map((r) => r.id).join(','))
await t.press('4')
const v4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('design 4 after bulk:', v4.join(','), 'lamps:', await t.lamps())
check('S3 拮抗バッジの行が選定者の 4 に「見直し推奨」で出る', contested.length === 0 || contested.some((r) => v4.includes(r.id)), `contested=${contested.length} in4=${contested.filter((r) => v4.includes(r.id)).length}`)
if (contested.length) { await t.goto(contested[0].id); log('contested status cell:', await t.cell(contested[0].id, 'status'), 'hint:', (await t.status()).match(/x[^?]*/)?.[0]); await t.press('x'); await page.waitForTimeout(50); log('x →', await t.cell(contested[0].id, 'status')) }
// ---- 商社を集約
await t.press('Control+k'); await page.getByTestId('palette-input').fill('集約'); await t.press('Enter'); await page.waitForTimeout(200)
const cons = await page.locator('[role=dialog]').textContent()
log('consolidate:', cons.slice(0, 500))
await t.press('Enter'); await page.waitForTimeout(300)
log('consolidate →', await t.toast())
p = await t.proj()
log('adopted dist:', p.rows.filter((r) => r.adoptedSupplierId).reduce((m, r) => ({ ...m, [r.adoptedSupplierId]: (m[r.adoptedSupplierId] ?? 0) + 1 }), {}), 'pending:', p.rows.filter((r) => r.flags.pmPending).length)
await t.shot('s3-02-after-bulk')
// ---- 見積済から5営業日以上の警告: quotedAt を古くする
await page.evaluate(() => { const ws = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = ws.projects[0]; const r = p.rows.find((r) => r.status === 'quoted' && !r.adoptedSupplierId); if (r) r.quotedAt = '2026-10-01'; localStorage.setItem('bom-pro.workspace.v2', JSON.stringify(ws)) })
await t.reload()
p = await t.proj()
const old = p.rows.find((r) => r.quotedAt === '2026-10-01')
if (old) { await t.goto(old.id); await t.press('a'); await page.waitForTimeout(50); log('a on old quotedAt →', await t.toast()) }
log('ERRORS:', t.errors)
await t.close()
