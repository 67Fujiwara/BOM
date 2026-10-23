// ラウンド8: F8 → 直す（Enter で下へ動く）→ F8 は次の問題へ進むか（V7-03 の続き）
import { launch, fresh, T, makeLog, shot, ui, typeReal, proj, sleep, sel, gotoCol } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t64_f8_continue')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const where = async () => { const u = await ui(page); return `${u.cursorRow}/${u.cursorCol}` }
const status = async () => (await page.getByTestId('status').innerText()).replace(/\s+/g, ' ')

await step('A. 一覧（F8 だけで 1 周）', async () => {
  await fresh(page); const seq = []
  for (let i = 0; i < 8; i++) { await page.keyboard.press('F8'); await sleep(60); seq.push(await where()) }
  log('  F8 x8:', seq.join(' → '))
})
await step('B. F8 F8（R009 メーカ空）→ オムロン → Enter → F8（期待: R041）', async () => {
  await fresh(page); await page.keyboard.press('F8'); await page.keyboard.press('F8'); await sleep(60); log('  at', await where())
  await typeReal(page, 'IDEC', 20); await page.keyboard.press('Enter'); await sleep(100); log('  after Enter', await where(), '|', await T.toast(page))
  await page.keyboard.press('F8'); await sleep(80); log('  F8 ->', await where(), '| status:', await status())
  await shot(page, 't64_B_after_fix_F8')
})
await step('C. 同じを Tab で確定 → F8', async () => {
  await fresh(page); await page.keyboard.press('F8'); await page.keyboard.press('F8'); await sleep(60)
  await typeReal(page, 'IDEC', 20); await page.keyboard.press('Tab'); await sleep(100); log('  after Tab', await where())
  await page.keyboard.press('F8'); await sleep(80); log('  F8 ->', await where())
})
await step('D. 3 つ目（R041 メーカ）を直して Enter → F8 / Shift+F8', async () => {
  await fresh(page); for (let i = 0; i < 3; i++) await page.keyboard.press('F8'); await sleep(60); log('  at', await where())
  await typeReal(page, 'IDEC', 20); await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('F8'); await sleep(80); log('  F8 ->', await where())
  await page.keyboard.press('Shift+F8'); await sleep(80); log('  Shift+F8 ->', await where())
})
await step('E. 先頭（R016 型式・指摘あり）を直して Enter → F8 → F8 …（指摘は公開まで残る）', async () => {
  await fresh(page); await page.keyboard.press('F8'); await sleep(60); log('  at', await where(), '|', await status())
  await typeReal(page, 'CP30-BA 2P 10A', 20); await page.keyboard.press('Enter'); await sleep(100)
  const seq = []
  for (let i = 0; i < 3; i++) { await page.keyboard.press('F8'); await sleep(60); seq.push(await where()) }
  log('  F8 x3:', seq.join(' → '), '| status:', await status())
  const p = await proj(page); const r = p.rows.find((x) => x.id === 'R016'); log('  R016 working', JSON.stringify(r.working), 'issues', JSON.stringify(p.issues.filter((i) => i.rowId === 'R016').map((i) => [i.id, i.kind, i.status])))
})
save(errors); await browser.close()
