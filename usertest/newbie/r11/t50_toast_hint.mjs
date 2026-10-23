// ラウンド7: 「権限なし…（例: Alt+○）」の案内どおりに押す新人。数字のビュー切替が効く場所。
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t50_toast_hint')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const brief = (r) => r && `${r.id}{st=${r.status} ord=${r.ordered} rcv=${r.received} hid=${r.hidden} sup=${r.adoptedSupplierId}}`
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }

await step('A. 購買: 部品名で Shift+I（指摘のつもり）→ 案内の「例: Alt+i」どおり Alt+i', async () => {
  await fresh(page, 'purchasing'); await sleep(200); await state('open')
  await sel(page, 'R013'); await gotoCol(page, '部品名'); await state('R013 部品名'); log('  before', brief(await row(page, 'R013')))
  await page.keyboard.press('Shift+KeyI'); await sleep(150); await state('Shift+I')
  await page.keyboard.press('Alt+KeyI'); await sleep(150); await state('Alt+i (案内どおり)')
  log('  after', brief(await row(page, 'R013'))); await shot(page, 't50_A_alt_i')
})
await step('A2. 購買: 型式で Shift+I → Alt+i（見積中の行）', async () => {
  await fresh(page, 'purchasing'); await sel(page, 'R076'); await gotoCol(page, '型式'); log('  before', brief(await row(page, 'R076')))
  await page.keyboard.press('Shift+KeyI'); await sleep(120); await state('Shift+I')
  await page.keyboard.press('Alt+KeyI'); await sleep(120); await state('Alt+i')
  log('  after', brief(await row(page, 'R076')))
})
await step('B. 設計: 単価（自動計算）で「ok」→ 案内「例: Alt+k」→ Alt+k', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R033'); await gotoCol(page, '単価'); await state('R033 単価')
  await typeReal(page, 'ok', 60); await state('ok'); await page.keyboard.press('Alt+KeyK'); await sleep(120); await state('Alt+k')
})
await step('B2. 設計: ボールで Shift+S（並べるつもりで Sensor）→ 案内 Alt+s / 「Delay」→ Alt+y', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, 'ボール')
  await typeReal(page, 'Delay', 60); await state('Delay'); await page.keyboard.press('Alt+KeyY'); await sleep(120); await state('Alt+y')
})
await step('C. 数字のビュー切替: 役割ごとの既定の位置で 1〜9', async () => {
  for (const role of ['design', 'purchasing', 'pm']) {
    await fresh(page, role); await sleep(200); await state(`${role} open`)
    for (const d of ['6', '8', '3', '7', '1', '4']) { const v0 = (await ui(page)).view; await page.keyboard.press(d); await sleep(120); const u = await ui(page); log(`   ${role} press ${d}: view ${v0}->${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`); if (u.mode === 'edit') { await page.keyboard.press('Escape'); await sleep(50) } }
  }
  const side = await page.locator('aside, .side, nav').first().innerText().catch(() => '')
  log('  side text:', side.replace(/\s+/g, ' ').slice(0, 300))
  await shot(page, 't50_C_pm_digits')
})
await step('D. PM: 7 で要決定の行に y（部品名にいる）/ ID 列で y', async () => {
  await fresh(page, 'pm'); await page.keyboard.press('Alt+7'); await sleep(150); await state('Alt+7')
  await page.keyboard.press('ArrowDown'); await sleep(80); await state('↓')
  await page.keyboard.press('y'); await sleep(150); await state('y on cell')
})
save(errors); await browser.close()
