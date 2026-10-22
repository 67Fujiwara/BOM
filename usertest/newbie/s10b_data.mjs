// S10b: サンプルに戻す・JSON 書き出し/読み込み・案件切替（S10 の続き）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast } from './lib.mjs'
import fs from 'node:fs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s10b_data')
try {
  await fresh(page)
  // 役割プロンプト: 名前欄が無い？ 2 を押す
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割'); await page.keyboard.press('Enter')
  log('role prompt has text input:', await page.getByTestId('prompt-text').count(), 'placeholder hint:', await page.locator('.dialog').textContent())
  await page.keyboard.press('2')
  log('after 2: role', await page.locator('.role button[aria-pressed="true"]').textContent(), 'name', await page.locator('.header > .muted').last().textContent(), 'view', await T.view(page))
  // 設計で編集 → サンプルに戻す
  await page.locator('.role button', { hasText: '設計' }).click(); await page.locator('.gridwrap').focus()
  await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('サンプル'); await page.keyboard.press('Enter')
  log('reset prompt:', await page.locator('.dialog h3').textContent(), 'options', await page.getByTestId('prompt-options').textContent())
  await page.keyboard.press('Enter')
  log('reset Enter (default=1 戻す?): toast', await T.toast(page), 'R030 model', await page.locator('[data-row-id="R030"] td.model').textContent(), 'role', await page.locator('.role button[aria-pressed="true"]').textContent())
  await page.keyboard.press('Control+z')
  log('Ctrl+Z after reset:', await T.toast(page))
  await shot(page, 's10b_after_reset')
  // JSON 書き出し
  await clearToast(page)
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await page.keyboard.press('Enter')
  const d = await dl
  log('download:', d ? d.suggestedFilename() : 'NONE', 'toast', await T.toast(page))
  let json = ''
  if (d) { const pth = await d.path(); json = fs.readFileSync(pth, 'utf8'); log('json size', json.length) }
  for (const [name, text] of [['invalid', 'これはJSONではない'], ['empty', ''], ['array', '[]'], ['noprojects', '{"a":1}'], ['partial', '{"projects":[{"id":"x","name":"壊れた"}],"currentProjectId":"x","user":{"role":"design","name":"n"}}'], ['valid', json]]) {
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter')
    await page.getByTestId('import-text').fill(text)
    await page.keyboard.press('Enter')
    log(`import[${name}] Enter: panel`, await T.panel(page))
    await page.keyboard.press('Control+Enter')
    await page.waitForTimeout(150)
    log(`import[${name}] Ctrl+Enter: panel`, await T.panel(page), 'toast', await T.toast(page), 'rows', await T.rows(page), 'grid', await page.getByTestId('grid').count(), 'errors so far', errors.length)
    if (!(await page.getByTestId('grid').count())) {
      await shot(page, 's10b_import_crash_' + name)
      log('CRASH after import', name, '-> reload')
      await page.reload(); await page.waitForTimeout(500)
      log('after reload grid?', await page.getByTestId('grid').count())
      if (!(await page.getByTestId('grid').count())) { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByTestId('grid').waitFor() }
    }
    await clearToast(page)
  }
  // 案件を増やして切替（未公開があるときの確認）
  await fresh(page)
  await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('X1'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-id').fill('P2'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('二つ目')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter')
  await page.waitForTimeout(50)
  log('created P2: header', (await T.header(page)).slice(0, 40), 'side projects', await page.locator('.side .view').filter({ hasNot: page.locator('.k') }).allTextContents(), 'view', await T.view(page), 'rows', await T.rows(page))
  await shot(page, 's10b_p2_empty_view4')
  await page.locator('.side .view', { hasText: '第3ライン' }).click()
  log('switch back by click: header', (await T.header(page)).slice(0, 40), 'toast', await T.toast(page), 'cursor', await T.cursor(page), 'view', await T.view(page), 'R030', await page.locator('[data-row-id="R030"] td.model').textContent())
  await page.locator('.side .view', { hasText: '二つ目' }).click()
  log('switch to P2 with unpublished: toast', await T.toast(page), 'confirm panel', await T.panel(page), 'status', (await T.status(page)).slice(0, 80))
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+z')
  log('Ctrl+Z in P2 (undo from other project?): toast', await T.toast(page), 'rows', await T.rows(page))
  await page.locator('.side .view', { hasText: '第3ライン' }).click()
  log('R030 after cross-project undo:', await page.locator('[data-row-id="R030"] td.model').textContent())
  await shot(page, 's10b_cross_project_undo')
  // 購買に切替えると設計の作業中の値が見える？
  await page.locator('.role button', { hasText: '購買' }).click()
  const cell = page.locator('[data-row-id="R030"] td.model')
  log('purchasing sees R030 model:', await cell.textContent(), 'class', await cell.getAttribute('class'), 'status cell', await page.locator('[data-row-id="R030"] td[data-col="status"]').textContent())
  await shot(page, 's10b_purchasing_sees_working')
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
