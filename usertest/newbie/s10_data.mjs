// S10: 役割ボタン連打・案件切替・サンプルに戻す・JSON 書き出し/読み込み（約8人）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast } from './lib.mjs'
import fs from 'node:fs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s10_data')
try {
  await fresh(page)
  // 役割ボタン連打
  for (let i = 0; i < 6; i++) { await page.locator('.role button', { hasText: ['購買', 'PM', '設計'][i % 3] }).click({ delay: 10 }) }
  log('after role spam: role', await page.locator('.role button[aria-pressed="true"]').textContent(), 'name', await page.locator('.header > .muted').last().textContent(), 'view', await T.view(page), 'cursor', await T.cursor(page))
  // 役割を変えてもビューは変わらない？（既定ビューは役割別のはず）
  await page.locator('.role button', { hasText: 'PM' }).click()
  log('PM view:', await T.view(page), 'counts 7:', await page.getByTestId('view-7').textContent())
  // 設計で未公開の編集 → 購買に切替 → 見えるか
  await page.locator('.role button', { hasText: '設計' }).click(); await page.locator('.gridwrap').focus()
  await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
  log('design edited model R030:', await page.locator('[data-row-id="R030"] td.model').textContent(), 'status', (await T.status(page)).match(/未公開 \d+ 行/)?.[0])
  await page.locator('.role button', { hasText: '購買' }).click()
  log('purchasing sees R030 model:', await page.locator('[data-row-id="R030"] td.model').textContent(), 'title', await page.locator('[data-row-id="R030"] td.model').getAttribute('title'))
  await shot(page, 's10_working_as_purchasing')
  // 購買で Ctrl+Z（設計の操作は戻せないはず）
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z')
  log('purchasing Ctrl+Z:', await T.toast(page))
  // Ctrl+K → 役割を切り替え（氏名入力）
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await page.keyboard.press('Enter')
  log('role prompt:', await T.panel(page), (await page.getByTestId('prompt-options').textContent()))
  await page.getByTestId('prompt-text').fill('新人太郎')
  await page.keyboard.press('Enter')
  log('after role prompt Enter (no choice): role', await page.locator('.role button[aria-pressed="true"]').textContent(), 'name', await page.locator('.header > .muted').last().textContent())
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await page.keyboard.press('Enter')
  await page.keyboard.press('2')
  log('role prompt press 2: role', await page.locator('.role button[aria-pressed="true"]').textContent(), 'name', await page.locator('.header > .muted').last().textContent(), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // 新人太郎（購買）が Ctrl+Z → 佐藤の操作ではないので戻せない
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z')
  log('新人太郎 Ctrl+Z:', await T.toast(page))
  // サンプルに戻す
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('サンプル'); await page.keyboard.press('Enter')
  log('reset prompt:', await page.locator('.dialog h3').textContent())
  await page.keyboard.press('Enter')
  log('reset Enter(default option?): toast', await T.toast(page), 'R030 model', await page.locator('[data-row-id="R030"] td.model').textContent(), 'role', await page.locator('.role button[aria-pressed="true"]').textContent(), 'name', await page.locator('.header > .muted').last().textContent())
  await shot(page, 's10_after_reset')
  // JSON 書き出し
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await page.keyboard.press('Enter')
  const d = await dl
  log('download:', d ? d.suggestedFilename() : 'NONE', 'toast', await T.toast(page))
  let json = ''
  if (d) { const pth = await d.path(); json = fs.readFileSync(pth, 'utf8'); log('json size', json.length) }
  // JSON 読み込み: 不正・空・正常
  for (const [name, text] of [['invalid', 'これはJSONではない'], ['empty', ''], ['array', '[]'], ['noprojects', '{"a":1}'], ['valid', json]]) {
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter')
    await page.getByTestId('import-text').fill(text)
    await page.keyboard.press('Enter')
    log(`import[${name}] Enter: panel`, await T.panel(page))
    await page.keyboard.press('Control+Enter')
    await page.waitForTimeout(100)
    log(`import[${name}] Ctrl+Enter: panel`, await T.panel(page), 'toast', await T.toast(page), 'rows', await T.rows(page), 'grid', await page.getByTestId('grid').count())
    await clearToast(page)
  }
  await shot(page, 's10_after_import')
  // 案件を増やして切替（未公開があるときの確認）
  await page.locator('.role button', { hasText: '設計' }).click(); await page.locator('.gridwrap').focus()
  await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('X1'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-id').fill('P2'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('二つ目')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter')
  log('created P2: header', (await T.header(page)).slice(0, 40), 'side projects', await page.locator('.side .view').filter({ hasNot: page.locator('.k') }).allTextContents())
  await page.locator('.side .view', { hasText: '第3ライン' }).click()
  log('switch back by click: header', (await T.header(page)).slice(0, 40), 'toast', await T.toast(page), 'cursor', await T.cursor(page), 'view', await T.view(page), 'R030', await page.locator('[data-row-id="R030"] td.model').textContent())
  await page.locator('.side .view', { hasText: '二つ目' }).click()
  log('switch to P2 with unpublished: toast', await T.toast(page), 'confirm panel', await T.panel(page))
  // Ctrl+Z after switching project
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z')
  log('Ctrl+Z in P2 (undo stack from other project?): toast', await T.toast(page), 'rows', await T.rows(page))
  await page.locator('.side .view', { hasText: '第3ライン' }).click()
  log('R030 after cross-project undo:', await page.locator('[data-row-id="R030"] td.model').textContent())
  await shot(page, 's10_cross_project_undo')
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
