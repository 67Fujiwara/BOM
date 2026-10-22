// S01: マウス中心の新人（約20人）。クリック・ダブルクリック・ヘッダーのボタン・サイドバー・オーバーレイ
import { launch, fresh, T, makeLog, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, finding, save } = makeLog('s01_mouse')
try {
  await fresh(page)
  // 1. サイドバーのビューをクリック
  await page.getByTestId('view-4').click()
  log('view after click 4:', await T.view(page), 'cursor:', await T.cursor(page))
  await page.getByTestId('view-1').click()
  // 2. セルをクリック → カーソル
  const r5 = page.locator('[data-row-id="R005"] td').nth(2)
  await r5.click()
  log('after click cell:', await T.cursor(page), 'mode', await T.mode(page))
  // 3. クリック後にキーで移動できるか（フォーカスは gridwrap? body?）
  const active = await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className)
  log('activeElement after cell click:', active)
  await page.keyboard.press('j')
  log('after j:', await T.cursor(page))
  // 4. ダブルクリックで編集 → 文字を打って Enter
  const nameCell = page.locator('[data-row-id="R005"] td.name')
  await nameCell.dblclick()
  log('after dblclick mode:', await T.mode(page))
  await page.keyboard.type('XYZ')
  const ev = page.getByTestId('cell-editor')
  log('editor value after type:', (await ev.count()) ? await ev.inputValue() : 'NO EDITOR')
  await page.keyboard.press('Enter')
  log('after Enter name R005:', await page.locator('[data-row-id="R005"] td.name').textContent(), 'cursor', await T.cursor(page))
  // 5. 編集中に別のセルをクリック（フォーカスが外れる）→ 文字を打つ
  await page.locator('[data-row-id="R006"] td.name').dblclick()
  await page.locator('[data-row-id="R010"] td.name').click()
  log('after click another cell during edit: mode', await T.mode(page), 'cursor', await T.cursor(page))
  await page.keyboard.type('abc')
  log('editor value after type (focus lost?):', (await ev.count()) ? await ev.inputValue() : 'NO EDITOR', 'active:', await page.evaluate(() => document.activeElement?.tagName))
  await page.keyboard.press('Enter')
  log('R006 name after Enter:', await page.locator('[data-row-id="R006"] td.name').textContent(), 'mode', await T.mode(page), 'toast', await T.toast(page))
  await shot(page, 's01_edit_focus_lost')
  // 6. ダブルクリックで権限外の列（購買の単価）・自動計算列（金額）
  await page.keyboard.press('Escape')
  const ths = await page.locator('table.grid th').allTextContents()
  log('columns:', ths.join('|'))
  const amountIdx = ths.findIndex((t) => t.includes('金額'))
  if (amountIdx >= 0) {
    await page.locator('[data-row-id="R020"] td').nth(amountIdx).dblclick()
    log('dblclick computed col: mode', await T.mode(page), 'toast', await T.toast(page))
    await page.keyboard.type('123')
    await page.keyboard.press('Enter')
    log('after Enter on computed: toast', await T.toast(page), 'mode', await T.mode(page))
  }
  const scoreIdx = ths.findIndex((t) => t.includes('スコア'))
  if (scoreIdx >= 0) {
    await page.locator('[data-row-id="R020"] td').nth(scoreIdx).dblclick()
    log('dblclick score col: mode', await T.mode(page))
    await page.keyboard.press('Escape')
  }
  // 7. 役割ボタンをクリック → その後キーを押す（フォーカスがボタンに残る）
  await page.locator('.role button', { hasText: '購買' }).click()
  log('role purchasing; active:', await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.textContent))
  await page.keyboard.press('j')
  log('after j (focus on button):', await T.cursor(page))
  await page.keyboard.press('Space')
  log('after Space with focus on button: panel', await T.panel(page), 'rows open?', await page.getByTestId('detail').count(), 'toast', await T.toast(page), 'role pressed:', await page.locator('.role button[aria-pressed="true"]').textContent())
  await page.keyboard.press('Enter')
  log('after Enter with focus on button: mode', await T.mode(page), 'toast', await T.toast(page), 'role pressed:', await page.locator('.role button[aria-pressed="true"]').textContent())
  await page.keyboard.press('Escape')
  // 8. 購買のまま型式をダブルクリックして編集
  await page.locator('[data-row-id="R012"] td.model').dblclick()
  log('purchasing dblclick model: mode', await T.mode(page), 'toast', await T.toast(page))
  await page.keyboard.press('Control+a')
  await page.keyboard.type('ZZZ')
  await page.keyboard.press('Enter')
  log('purchasing commit model: toast', await T.toast(page), 'model now', await page.locator('[data-row-id="R012"] td.model').textContent())
  // 9. ヘッダーの Ctrl+K ボタンをクリック → 項目をクリック
  await page.locator('.header .btn').click()
  log('palette open by button:', await T.panel(page))
  await page.getByTestId('palette-input').fill('ヘルプ')
  const n = await page.getByTestId('palette-list').locator('.item').count()
  log('palette "ヘルプ" items:', n, (await page.getByTestId('palette-list').allTextContents()).join('|').slice(0, 200))
  await page.getByTestId('palette-input').fill('ショートカット')
  await page.getByTestId('palette-list').locator('.item').first().click()
  log('after click item: panel', await T.panel(page))
  // 10. オーバーレイの外をクリックして閉じる
  await page.locator('.overlay').click({ position: { x: 5, y: 5 } })
  log('after click overlay backdrop: panel', await T.panel(page), 'mode', await T.mode(page))
  // 11. 分類見出しをクリック → Space
  await page.locator('.role button', { hasText: '設計' }).click()
  await page.locator('.gridwrap').focus()
  const grp = page.getByTestId('group-row').first()
  if (await grp.count()) {
    await grp.click()
    log('group row clicked cursor:', await T.cursor(page), 'status:', (await T.status(page)).slice(0, 120))
    await page.keyboard.press('Space')
    log('after Space on group: rows', await T.rows(page))
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    log('Enter on group row: mode', await T.mode(page), 'toast', await T.toast(page))
    await page.keyboard.press('Escape')
    await page.keyboard.press('a')
    log('a on group row: toast', await T.toast(page))
  }
  // 12. 列ヘッダをクリック（並び替えを期待する新人）
  await page.locator('table.grid th').nth(3).click()
  log('click th: sort chip?', await page.locator('.toolbar .chip').allTextContents())
  // 13. 案件をサイドバーでクリック
  const projs = page.locator('.side .view').filter({ hasNot: page.locator('.k') })
  log('projects in side:', await projs.count())
  // 14. 行をクリックして Space → 詳細、詳細内の指摘をクリック
  await page.locator('[data-row-id="R016"] td.name').click()
  await page.keyboard.press('Space')
  log('detail open:', await page.getByTestId('detail').count())
  const issueLi = page.getByTestId('issues').locator('li').first()
  await issueLi.click()
  log('after click issue li: status', (await T.status(page)).slice(0, 160))
  await page.keyboard.press('Enter')
  log('Enter after clicking issue: panel', await T.panel(page), 'mode', await T.mode(page))
  await shot(page, 's01_issue_click_enter')
  await page.keyboard.press('Escape')
  // 15. ステータスバーのヒントをクリック（押せると思う）
  await page.locator('.status .hints span').first().click()
  log('click status hint: mode', await T.mode(page), 'panel', await T.panel(page))
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
