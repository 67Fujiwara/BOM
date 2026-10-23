// 取消・置換は公開まで設計の作業中: 新人設計の Shift+Delete / r / Ctrl+Z / 公開、購買からの見え方、PM 承認 ON で却下
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, runPalette, setRole, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t14_cancel')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const st = (id) => row(page, id).then((r) => r ? `${r.id}:${r.status}${r.removal ? ' removal=' + JSON.stringify(r.removal) : ''}${r.pendingRemoval ? ' pendingRemoval=' + JSON.stringify(r.pendingRemoval) : ''}${r.replaces ? ' replaces=' + r.replaces : ''}${r.working ? ' working=' + JSON.stringify(r.working) : ''} model=${r.model}` : `${id}: (なし)`)
const cell = async (id) => { const l = page.locator(`[data-row-id="${id}"]`); return (await l.count()) ? (await l.first().innerText()).replace(/\s+/g, ' ').slice(0, 140) : '(DOM なし)' }
const panels = async (keys, tag) => { for (const k of keys) { const pt = await T.panelText(page); if (!pt) break; log(`  [${tag}] panel: ${pt.slice(0, 220)}`); await page.keyboard.press(k); await page.waitForTimeout(120) } log(`  [${tag}] toast: ${await T.toast(page)}`) }
await fresh(page)
await step('first publish', async () => { await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['2', 'Enter', 'Enter'], 'pub0') })
await step('cancel R030', async () => {
  await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(100)
  log('Shift+Delete R030 ->', await T.toast(page), await T.panelText(page), '|', await st('R030'))
  log('  design sees', await cell('R030'))
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R030'); log('  purchasing sees', await cell('R030'))
  await runPalette(page, '正式見積を依頼'); log('  purchasing formal confirm', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Escape')
  await setRole(page, 'design')
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['Enter', '1', 'Enter', 'Enter'], 'pub-cancel')
  log('  after publish', await st('R030'))
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); log('  Ctrl+Z after publish ->', await T.toast(page), await st('R030'))
  await page.keyboard.press('1'); await sel(page, 'R030'); log('  design sees', await cell('R030'))
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R030'); log('  purchasing sees', await cell('R030'))
  await setRole(page, 'design')
})
await step('replace R031', async () => {
  await page.keyboard.press('1'); await sel(page, 'R031'); await page.keyboard.press('r'); await page.waitForTimeout(80)
  log('r ->', (await T.panelText(page))?.slice(0, 160))
  await page.getByTestId('prompt-text').fill('NEW-MODEL-1'); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
  log('  Enter ->', await T.toast(page), await T.panelText(page), '|', await st('R031'))
  const p = await proj(page); const nr = p.rows.find((r) => r.replaces === 'R031'); log('  new row', nr && (await st(nr.id)), 'cursor', (await ui(page)).cursorRow)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); log('  Ctrl+Z ->', await T.toast(page), await st('R031'), 'rows', (await proj(page)).rows.length)
  await page.keyboard.press('Control+y'); await page.waitForTimeout(100); log('  Ctrl+Y ->', await T.toast(page), await st('R031'), 'rows', (await proj(page)).rows.length)
  // 置換先（下書き）を Shift+Delete
  const id = (await proj(page)).rows.find((r) => r.replaces === 'R031')?.id
  if (id) { await sel(page, id); await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(100); log(`  Shift+Delete ${id} ->`, await T.toast(page), await st('R031'), await st(id)) }
  // もう一度置換して公開
  await sel(page, 'R031'); await page.keyboard.press('r'); await page.getByTestId('prompt-text').fill('NEW-MODEL-2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['Enter', '3', 'Enter', 'Enter'], 'pub-replace')
  const id2 = (await proj(page)).rows.find((r) => r.replaces === 'R031' && r.model === 'NEW-MODEL-2')?.id
  log('  after publish', await st('R031'), id2 && (await st(id2)))
  await setRole(page, 'purchasing'); await page.keyboard.press('5'); await page.waitForTimeout(100); log('  purchasing 5 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(',')))
  await setRole(page, 'design')
})
await step('PM approval ON + reject', async () => {
  await setRole(page, 'pm'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
  const txt = await T.panelText(page); log('settings', txt?.slice(0, 120))
  // 「設計変更は PM 承認が必要」まで ↓
  for (let i = 0; i < 20; i++) { const sel_ = await page.locator('.overlay [aria-selected="true"]').innerText().catch(() => ''); if (/承認が必要/.test(sel_)) break; await page.keyboard.press('ArrowDown') }
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  edit approval field ->', (await T.panelText(page))?.slice(-200))
  await page.keyboard.press('Control+a'); await page.keyboard.type('はい'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(120); log('  save ->', (await T.panelText(page))?.slice(0, 200), await T.toast(page))
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { const pt = await T.panelText(page); log('   panel', pt?.slice(0, 200)); if (/理由/.test(pt ?? '')) { await page.keyboard.insertText('テスト'); } await page.keyboard.press('Enter'); await page.waitForTimeout(120) }
  log('  approval setting', JSON.stringify((await proj(page)).settings.pmApprovalForChanges ?? (await proj(page)).settings))
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R032'); await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(80)
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['Enter', '2', 'Enter', 'Enter'], 'pub-pm')
  log('  R032 after publish', await st('R032'))
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R032'); log('  purchasing sees R032', await cell('R032'))
  await setRole(page, 'pm'); log('  PM 7', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(',')))
  await sel(page, 'R032'); log('  hints', await T.hints(page)); await page.keyboard.press('Shift+Y'); await page.waitForTimeout(100)
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('   panel', (await T.panelText(page))?.slice(0, 160)); await page.keyboard.press('Enter'); await page.waitForTimeout(120) }
  log('  after Shift+Y', await T.toast(page), await st('R032'))
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R032'); log('  design sees R032', await cell('R032'), '| hints', await T.hints(page))
  await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(80); log('  Shift+Delete again ->', await T.toast(page), await st('R032'))
  await shot(page, 't14_after_reject')
})
save(errors); await browser.close()
