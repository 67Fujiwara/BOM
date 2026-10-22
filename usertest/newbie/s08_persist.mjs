// S08: リロード・戻る・テーマ・案件位置の保持（約8人）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s08_persist')
try {
  await fresh(page)
  await sel(page, 'R030')
  await gotoCol(page, '部品名')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('編集テスト'); await page.keyboard.press('Enter')
  await page.keyboard.press('4')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  const before = { view: await T.view(page), cursor: await T.cursor(page), name: await page.locator('[data-row-id="R030"] td.name').textContent().catch(() => '-') }
  log('before reload:', before)
  await page.reload()
  await page.getByTestId('grid').waitFor()
  log('after reload: view', await T.view(page), 'cursor', await T.cursor(page), 'R030 name', await page.locator('[data-row-id="R030"] td.name').textContent(), 'status', (await T.status(page)).slice(0, 80), 'role', await page.locator('.role button[aria-pressed="true"]').textContent())
  await page.keyboard.press('Control+z')
  log('Ctrl+Z after reload:', await T.toast(page), 'name', await page.locator('[data-row-id="R030"] td.name').textContent())
  // 役割を購買にしてリロード
  await page.locator('.role button', { hasText: '購買' }).click()
  await page.reload(); await page.getByTestId('grid').waitFor()
  log('role after reload:', await page.locator('.role button[aria-pressed="true"]').textContent(), 'view', await T.view(page))
  // ブラウザ戻る
  await page.goBack().catch((e) => log('goBack err', String(e)))
  await page.waitForTimeout(300)
  log('after goBack url:', page.url(), 'grid?', await page.getByTestId('grid').count())
  await page.goto('http://localhost:5173/'); await page.getByTestId('grid').waitFor()
  // ダークモード → リロード
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダーク'); await page.keyboard.press('Enter')
  log('theme toast', await T.toast(page), 'data-theme', await page.evaluate(() => document.documentElement.dataset.theme))
  await page.reload(); await page.getByTestId('grid').waitFor()
  log('theme after reload', await page.evaluate(() => document.documentElement.dataset.theme))
  await shot(page, 's08_dark_after_reload')
  // 2タブ同時（同じ localStorage）: 別タブで編集→こちらで編集→上書き？
  const page2 = await page.context().newPage()
  await page2.goto('http://localhost:5173/'); await page2.getByTestId('grid').waitFor()
  await page2.locator('.role button', { hasText: '設計' }).click(); await page2.locator('.gridwrap').focus()
  await sel(page2, 'R031'); await gotoCol(page2, '部品名'); await page2.keyboard.press('Enter'); await page2.keyboard.press('Control+a'); await page2.keyboard.type('タブ2'); await page2.keyboard.press('Enter')
  await page.locator('.role button', { hasText: '設計' }).click(); await page.locator('.gridwrap').focus()
  await sel(page, 'R032'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('タブ1'); await page.keyboard.press('Enter')
  const w = await store(page)
  const p = w.projects[0]
  log('2 tabs: R031', p.rows.find((r) => r.id === 'R031').working?.name ?? p.rows.find((r) => r.id === 'R031').name, 'R032', p.rows.find((r) => r.id === 'R032').working?.name ?? '(lost)')
  await page2.reload(); await page2.getByTestId('grid').waitFor()
  log('tab2 after reload R031', await page2.locator('[data-row-id="R031"] td.name').textContent(), 'R032', await page2.locator('[data-row-id="R032"] td.name').textContent())
  await page2.close()
  // localStorage を壊す（古い形式）
  await page.evaluate(() => localStorage.setItem('bom-pro.workspace.v2', '{"projects":[{"id":"x"}],"user":{"role":"design","name":"n"}}'))
  await page.reload()
  await page.waitForTimeout(500)
  log('broken storage: grid?', await page.getByTestId('grid').count(), 'body text', (await page.locator('body').textContent()).slice(0, 100))
  await shot(page, 's08_broken_storage')
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
