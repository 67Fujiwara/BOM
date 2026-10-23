// R13: PM の新人（要決定・案件設定・役割違い）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r13_pm')
const settingsDue = async () => (await page.getByTestId('settings').innerText().catch(() => '-')).replace(/\s+/g, ' ').match(/案件納期 \S+/)?.[0]
try {
  await fresh(page, 'pm')
  log('pm view', await T.view(page), 'rows', await T.rows(page), 'chips', await page.locator('.toolbar .chip').allTextContents())
  // 7 で ↓ Enter → 決定パネル → y → 理由空 Enter
  await page.keyboard.press('ArrowDown'); log('cursor', await T.cursor(page))
  await page.keyboard.press('y'); log('y prompt:', await T.panelText(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('y Enter (no reason):', await T.toast(page), 'rows', await T.rows(page))
  await page.keyboard.press('Control+z'); log('Ctrl+Z:', await T.toast(page), 'rows', await T.rows(page))
  // 案件レベルの要決定（案件設定確定）を探す
  const r7 = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((tr) => tr.dataset.rowId + ':' + tr.innerText.replace(/\s+/g, ' ').slice(0, 80)))
  log('view7 rows', r7)
  // 案件設定 → 納期 過去日 / 未定 / 来月
  for (const v of ['2025-01-01', '来月', '未定', '2026-11-20 ']) {
    await runPalette(page, '案件設定'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    await page.getByTestId('settings-input').fill(v); await page.keyboard.press('Enter')
    log(`settings due "${v}":`, await T.toast(page), 'draft', await settingsDue(), 'error', await page.locator('[data-testid=settings] .err-text').textContent().catch(() => null))
    await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
    log('  Ctrl+Enter: panel', await T.panelText(page))
    await shot(page, 'r13_settings_' + v.replace(/\W/g, '_'))
    if ((await T.panel(page)) === 'panel-impact') { await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  impact Enter ->', await T.panelText(page)) }
    if ((await T.panel(page)) === 'panel-prompt') { await page.getByTestId('prompt-text').fill('客先都合').catch(() => {}); await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
    for (let i = 0; i < 3 && (await T.panel(page)) && (await T.panel(page)) !== 'panel-settings'; i++) { log('  more panel', await T.panelText(page)); await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
    log('  result toast', await T.toast(page), 'header due', await page.getByTestId('due').textContent())
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
    await clearToast(page)
  }
  // 設定パネル: Esc 1 回で未保存の変更が消える？
  await runPalette(page, '案件設定'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await page.getByTestId('settings-input').fill('12'); await page.keyboard.press('Enter')
  log('draft processDays 12 then Esc (no save)')
  await page.keyboard.press('Escape'); log('  panel after Esc', await T.panel(page), 'toast', await T.toast(page))
  await runPalette(page, '案件設定'); log('  reopen settings processDays', (await page.getByTestId('settings').innerText()).replace(/\s+/g, ' ').match(/社内工程日数（この案件） \S+/)?.[0])
  await page.keyboard.press('Escape')
  // 重み 雑な入力
  for (const v of ['50 50', '40、30、20、10', '４０,３０,２０,１０', '100,0,0,0', 'a,b,c,d']) {
    await runPalette(page, '案件設定'); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    await page.getByTestId('settings-input').fill(v); await page.keyboard.press('Enter')
    log(`weights "${v}":`, await T.toast(page))
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
    await clearToast(page)
  }
  // 選定者を購買に（PM）
  await runPalette(page, '案件設定'); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await page.getByTestId('settings-input').fill('purchasing'); await page.keyboard.press('Enter'); log('selector purchasing:', await T.toast(page))
  await page.getByTestId('settings-input').fill('購買').catch(() => {}); await page.keyboard.press('Enter'); log('selector 購買:', await T.toast(page))
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); log('  save:', await T.panelText(page))
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { if (await page.getByTestId('prompt-text').count()) await page.getByTestId('prompt-text').fill('購買に任せる'); await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
  log('  result', await T.toast(page))
  // PM が表で Enter/文字
  await page.keyboard.press('1'); await sel(page, 'R020'); await gotoCol(page, '部品名')
  await clearToast(page); await page.keyboard.press('Enter'); log('PM Enter on name:', await T.toast(page), 'mode', await T.mode(page))
  await clearToast(page); await page.keyboard.type('テスト'); log('PM type on name:', await T.toast(page), 'mode', await T.mode(page))
  await page.keyboard.press('Escape')
  await clearToast(page); await page.keyboard.press('Control+Enter'); log('PM Ctrl+Enter:', await T.toast(page))
  await clearToast(page); await page.keyboard.press('Shift+I'); log('PM Shift+I:', await T.panelText(page), await T.toast(page)); await page.keyboard.press('Escape')
  // ヘルプを PM で開く: 役割に関係ないキーも全部出る？
  await page.keyboard.press('?'); const help = (await page.getByTestId('help').innerText()).replace(/\s+/g, ' ')
  log('help length', help.length, 'mentions role?', /PM/.test(help), help.slice(0, 300))
  await shot(page, 'r13_help_pm')
  await page.keyboard.press('Escape')
} catch (e) { log('EXC', String(e).slice(0, 400)) }
save(errors)
await browser.close()
