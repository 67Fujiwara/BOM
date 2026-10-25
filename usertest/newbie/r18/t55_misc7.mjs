// ラウンド7: Enter から打ち直す（既存の値）、Alt+h、行なしの状態、F8 の端、順番に直すモード
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep, setRole, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t55_misc7')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} filter=${JSON.stringify(u.filter)}/${JSON.stringify(u.cellFilter)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const q = async (id, sid) => { const r = await row(page, id); const x = (r.quotes ?? []).find((z) => z.supplierId === sid); return JSON.stringify(x ? { p: x.unitPrice, lt: x.leadDays, moq: x.moq } : null) }
await step('A. 購買: 見積済の単価を打ち直す（Enter → 新しい値 → Enter）', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(150); await state('Alt+6')
  await sel(page, 'R033'); for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') } await state('at price'); log('  before', await q('R033', 'S1'))
  await page.keyboard.press('Enter'); await sleep(80); await state('Enter'); await typeReal(page, '95', 60); await state('typed 95'); await page.keyboard.press('Enter'); await sleep(120); await state('Enter')
  log('  after', await q('R033', 'S1'))
  await page.keyboard.press('ArrowUp'); await typeReal(page, '97', 60); await page.keyboard.press('Enter'); await sleep(120); log('  direct typing 97 ->', await q('R033', 'S1'))
  // 正しい値を戻す
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await sleep(80); log('  Ctrl+Z x2 ->', await q('R033', 'S1'), await T.toast(page))
  const problems = (await T.status(page)).replace(/\s+/g, ' ').slice(0, 200); log('  status', problems)
})
await step('A2. 設計: 必要数を打ち直す（Enter → 3 → Enter）', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '必要数'); const r0 = await row(page, 'R030'); log('  before', r0.qtyNeeded)
  await page.keyboard.press('Enter'); await typeReal(page, '3'); await page.keyboard.press('Enter'); await sleep(100); const r1 = await row(page, 'R030'); log('  after', JSON.stringify(r1.working ?? null), r1.qtyNeeded)
  await state('after'); await shot(page, 't55_A2_qty')
})
await step('B. Alt+h（4 要確認で）→ カーソル → Ctrl+Z', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('4'); await sleep(100); await state('4')
  await page.keyboard.press('ArrowDown'); await sleep(50); await state('↓')
  const id0 = (await ui(page)).cursorRow
  await page.keyboard.press('Alt+KeyH'); await sleep(150); await state('Alt+h'); log('  hidden', id0, (await row(page, id0)).hidden)
  await page.keyboard.press('Control+z'); await sleep(150); await state('Ctrl+Z'); log('  hidden after undo', (await row(page, id0)).hidden)
})
await step('C. 絞り込み 0 行で英字・数字を打つ', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('/'); await page.keyboard.type('zzzzz'); await page.keyboard.press('Enter'); await sleep(120); await state('filter zzzzz')
  await typeReal(page, 'Omron', 40); await state('typed Omron')
  await page.keyboard.press('4'); await sleep(100); await state('4')
  await page.keyboard.press('Escape'); await sleep(100); await state('Esc')
  await page.keyboard.press('Escape'); await sleep(100); await state('Esc2')
})
await step('D. 順番に直すモードで値を打つ、途中で Esc / Ctrl+K', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Control+Shift+KeyF'); await sleep(150); await state('seq'); log('  panel', await T.panelText(page))
  await page.keyboard.press('Enter'); await sleep(100); await state('Enter (編集する)')
  await typeReal(page, 'Omron', 40); await page.keyboard.press('Enter'); await sleep(200); await state('Omron Enter'); log('  panel', await T.panelText(page))
  await page.keyboard.press('Control+k'); await sleep(100); await state('Ctrl+K in seq')
  await page.keyboard.press('Escape'); await sleep(100); await state('Esc')
  await page.keyboard.press('Escape'); await sleep(100); await state('Esc2')
  const p = await proj(page); log('  R009 maker', JSON.stringify((p.rows.find((r) => r.id === 'R009')).working ?? null))
})
await step('E. F8 / Shift+F8 で全部回る（何件で 1 周）', async () => {
  await fresh(page); const seen = []
  for (let i = 0; i < 20; i++) { await page.keyboard.press('F8'); await sleep(40); const u = await ui(page); seen.push(`${u.cursorRow}/${u.cursorCol}`) }
  log('  F8 x20', seen.join(' '))
  const back = []; for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+F8'); await sleep(40); const u = await ui(page); back.push(`${u.cursorRow}/${u.cursorCol}`) }
  log('  Shift+F8 x6', back.join(' '), '| view', (await ui(page)).view, '| toast', await T.toast(page))
})
save(errors); await browser.close()
