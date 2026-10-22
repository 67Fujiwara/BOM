import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
// 閾値超の例外選定を探す: 1位より高くて差が大きい商社を選ぶ
let hit = null
for (const r of p.rows.filter((r) => r.status === 'quoted' && r.qtyNeeded > 0)) {
  await t.goto(r.id); await t.press('Shift+A')
  const opts = await page.getByTestId('adopt').locator('.opt').allTextContents()
  const parsed = opts.map((o) => ({ price: Number((o.match(/¥([\d,]+)/)?.[1] ?? '0').replace(/,/g, '')), score: Number(o.match(/スコア ([\d.]+)/)?.[1] ?? 0) }))
  let idx = -1
  for (let i = 1; i < parsed.length; i++) { const d = (parsed[i].price - parsed[0].price) * r.qtyNeeded; const pct = (parsed[i].price - parsed[0].price) / parsed[0].price; if (parsed[0].score - parsed[i].score > 5 && d > 10000 && pct > 0.03) { idx = i; break } }
  if (idx < 0) { await t.press('Escape'); continue }
  log('candidate', r.id, opts)
  await t.press(String(idx + 1)); await page.waitForTimeout(50); await t.press('6'); await page.waitForTimeout(50)
  log('→', await t.toast(), 'status:', await t.cell(r.id, 'status'))
  hit = r.id
  break
}
check('S3 閾値超（金額差>¥10,000 かつ 3%、拮抗超）の例外選定は PM承認待ち', hit && /PM承認待ち/.test(await t.cell(hit, 'status')), hit ? await t.cell(hit, 'status') : 'no candidate')
if (hit) {
  log('ball:', await t.cell(hit, 'ball'), 'detail reason:', (await t.row(hit)).adoptReason)
  // 承認待ちの行は a / 正式依頼から除外されるか
  await t.press('a'); await page.waitForTimeout(50); log('a on pending →', await t.toast())
  await t.role('pm'); await t.press('7')
  const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
  log('PM 7:', v7.join(','), 'status bar:', await t.status())
  check('S3 7 に理由付きで載る', v7.includes(hit))
  await t.goto(hit); await t.press('Enter')
  log('decision panel (例外選定):', await page.getByTestId('quickfix').textContent())
  await t.press('b'); await page.waitForTimeout(50)
  log('after b:', await page.locator('[role=dialog]').textContent().catch(() => ''))
  await t.press('Escape')
  await t.goto(hit); await t.press('y'); await page.waitForTimeout(50)
  log('y dialog:', await page.locator('[role=dialog]').textContent().catch(() => ''))
  await t.press('Enter'); await page.waitForTimeout(50)
  log('after y →', await t.toast(), 'status:', await t.cell(hit, 'status'), 'adopted:', await t.cell(hit, 'adopted'))
  check('S3 PM の y で選定済になる', /^選定済/.test(await t.cell(hit, 'status')))
  // 2 回目: 却下 → 見積済、選定者のボール
  await t.role('design')
  p = await t.proj()
  let hit2 = null
  for (const r of p.rows.filter((r) => r.status === 'quoted' && r.qtyNeeded > 0 && r.id !== hit)) {
    await t.goto(r.id); await t.press('Shift+A')
    const opts = await page.getByTestId('adopt').locator('.opt').allTextContents()
    const parsed = opts.map((o) => ({ price: Number((o.match(/¥([\d,]+)/)?.[1] ?? '0').replace(/,/g, '')), score: Number(o.match(/スコア ([\d.]+)/)?.[1] ?? 0) }))
    let idx = -1
    for (let i = 1; i < parsed.length; i++) { const d = (parsed[i].price - parsed[0].price) * r.qtyNeeded; const pct = (parsed[i].price - parsed[0].price) / parsed[0].price; if (parsed[0].score - parsed[i].score > 5 && d > 10000 && pct > 0.03) { idx = i; break } }
    if (idx < 0) { await t.press('Escape'); continue }
    await t.press(String(idx + 1)); await page.waitForTimeout(50); await t.press('6'); await page.waitForTimeout(50)
    hit2 = r.id; break
  }
  if (hit2) {
    await t.role('pm'); await t.goto(hit2); await t.press('Shift+Y'); await page.waitForTimeout(50)
    await page.getByTestId('prompt-text').fill('高すぎる'); await t.press('Enter'); await page.waitForTimeout(50)
    log('Shift+Y →', await t.toast(), 'status:', await t.cell(hit2, 'status'), 'ball:', await t.cell(hit2, 'ball'))
    check('S3 却下 → 見積済・選定者（設計）のボール', /^見積済/.test(await t.cell(hit2, 'status')) && (await t.cell(hit2, 'ball')) === '設計')
  }
}
// 集約の試算の整合: 現在総額 vs 各案
await t.role('design')
await t.press('Control+k'); await page.getByTestId('palette-input').fill('集約'); await t.press('Enter'); await page.waitForTimeout(200)
log('consolidate:', (await page.locator('[role=dialog]').textContent()).slice(0, 700))
log('header money:', await t.money())
await t.press('Escape')
log('ERRORS:', t.errors)
await t.close()
