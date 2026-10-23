// ラウンド8: サイドバーの「? ショートカット一覧」を見て ? を押す新人（打てるセルにいるとき）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t67_side_help')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
await step('A. 設計: ↓（R001 部品名）→ サイドのヒント欄を読む → ? → Enter → Ctrl+Enter', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(80)
  const hint = (await page.getByTestId('side').innerText()).replace(/\s+/g, ' '); log('  side hint:', hint.slice(hint.indexOf('ヒント'), hint.indexOf('ヒント') + 80))
  log('  status hints:', await T.hints(page))
  await page.keyboard.press('?'); await sleep(80); await state('?')
  await page.keyboard.press('Enter'); await sleep(80); await state('Enter')
  const p = await proj(page); log('  R001', JSON.stringify(p.rows.find((r) => r.id === 'R001').working))
  await shot(page, 't67_A_side_q')
})
await step('B. 新しい BOM（1 つずつ入力）で型式に ? を入れて公開', async () => {
  await fresh(page)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(300); await state('created')
  await page.keyboard.insertText('x'); await sleep(50)
  const u = await ui(page); log('  after create mode', u.mode, u.cursorRow, u.cursorCol)
  if (u.mode === 'edit') { await page.keyboard.press('Control+a'); await page.keyboard.insertText('リレー'); await page.keyboard.press('Tab') }
  await sleep(80); await page.keyboard.press('?'); await page.keyboard.press('Tab'); await sleep(80); await page.keyboard.insertText('') ; await state('model ?')
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter')
  const p = await proj(page); log('  rows', JSON.stringify(p.rows.map((r) => [r.id, r.name, r.model, r.maker, r.status])))
})
save(errors); await browser.close()
