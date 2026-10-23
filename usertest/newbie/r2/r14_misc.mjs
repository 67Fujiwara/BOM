// R14: 貼り付け・Undo 連打・隠す/列・ヘルプ・リロード・役割切替と Undo
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, paletteTop, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r14_misc')
const W = async (id) => { const r = (await store(page))?.projects[0].rows.find((r) => r.id === id); return r ? JSON.stringify({ n: r.name, m: r.model, q: r.qtyNeeded, w: r.working }) : '-' }
const clip = (t) => page.evaluate((t) => navigator.clipboard.writeText(t), t)
try {
  // Ctrl+V: Excel の複数セル（3行×2列）を部品名に
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R078'); await gotoCol(page, '部品名')
  await clip('A部品\tA型式\nB部品\tB型式\nC部品\tC型式\nD部品\tD型式'); await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
  log('paste 4x2 at R078 name:', await T.toast(page), 'R078', await W('R078'), 'R080', await W('R080'), 'rows', await T.rows(page), 'R081', await W('R081'))
  await page.keyboard.press('Control+z'); log('  undo:', await T.toast(page), 'R078', await W('R078'), 'R080', await W('R080'), 'rows', await T.rows(page))
  // 必要数列に文字を貼る
  await sel(page, 'R077'); await gotoCol(page, '必要数'); await clip('たくさん\n十\n-3'); await page.keyboard.press('Control+v'); await page.waitForTimeout(150)
  log('paste text into qty:', await T.toast(page), 'R077', await W('R077'), 'R078', await W('R078'), 'R079', await W('R079'))
  // 読み取り専用列に貼る
  await gotoCol(page, '状態'); await clip('発注済'); await page.keyboard.press('Control+v'); await page.waitForTimeout(100); log('paste into status:', await T.toast(page))
  // 大量テキストを 1 セル
  await gotoCol(page, '部品名'); await clip('あ'.repeat(5000)); await page.keyboard.press('Control+v'); await page.waitForTimeout(150); log('paste 5000 chars:', await T.toast(page), (await W('R077')).length)
  // 貼り付け中に購買列（設計）
  // Undo 連打
  await fresh(page); await page.keyboard.press('1')
  await sel(page, 'R030'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('X'); await page.keyboard.press('Enter')
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Control+z'); log(`Ctrl+Z #${i + 1}:`, await T.toast(page)) }
  await page.keyboard.press('Control+y'); log('Ctrl+Y:', await T.toast(page), 'R030', await W('R030'))
  await page.keyboard.press('Control+Shift+Z'); log('Ctrl+Shift+Z:', await T.toast(page))
  // 役割切替後の Undo
  await sel(page, 'R031'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('Y'); await page.keyboard.press('Enter')
  await setRole(page, 'purchasing'); await page.keyboard.press('Control+z'); log('purchasing Ctrl+Z (design edit):', await T.toast(page), 'R031', await W('R031'))
  await setRole(page, 'design'); await page.keyboard.press('Control+z'); log('design back Ctrl+Z:', await T.toast(page), 'R031', await W('R031'))
  // リロード中の編集
  await sel(page, 'R032'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('未確定の入力')
  let dialog = null; page.once('dialog', async (d) => { dialog = d.type() + ':' + d.message(); await d.dismiss() })
  await page.reload().catch((e) => log('reload err', String(e).slice(0, 80))); await page.waitForTimeout(500)
  log('reload during edit: beforeunload dialog', dialog, 'R032', await W('R032'))
  // h で隠した行を探す
  await page.locator('.gridwrap').focus(); await page.keyboard.press('4'); await page.keyboard.press('ArrowDown')
  const hid = (await T.cursor(page)).split(' ')[0]; await page.keyboard.press('h')
  log(`h on ${hid} in view4:`, await T.toast(page), 'visible', await page.locator(`[data-row-id="${hid}"]`).count(), 'rows', await T.rows(page))
  await page.keyboard.press('1'); log('  view1 visible', await page.locator(`[data-row-id="${hid}"]`).count(), 'class', await page.locator(`[data-row-id="${hid}"]`).getAttribute('class').catch(() => '-'))
  await palette(page, '隠した'); log('  palette 隠した:', await paletteTop(page, 3)); await page.keyboard.press('Escape')
  await palette(page, '表示'); log('  palette 表示:', await paletteTop(page, 4)); await page.keyboard.press('Escape')
  // c で列を隠す → リロード
  await sel(page, 'R020'); await page.keyboard.press('c'); log('c panel:', (await T.panelText(page)).slice(0, 200))
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press(' '); await page.keyboard.press('Escape')
  const cols1 = await page.evaluate(() => [...document.querySelectorAll('thead th')].map((t) => t.textContent.trim()).join('|'))
  log('cols after hide:', cols1)
  await page.reload(); await page.getByTestId('grid').waitFor()
  log('cols after reload:', await page.evaluate(() => [...document.querySelectorAll('thead th')].map((t) => t.textContent.trim()).join('|')))
  // ヘルプ: ? → スクロール・検索・Ctrl+K
  await page.locator('.gridwrap').focus(); await page.keyboard.press('?')
  const helpInfo = await page.evaluate(() => { const h = document.querySelector('[data-testid=help]'); return { sh: h?.scrollHeight, ch: h?.clientHeight, text: h?.innerText.slice(0, 200) } })
  log('help:', JSON.stringify(helpInfo))
  await page.keyboard.type('採用'); log('typing in help: panel', await T.panel(page))
  await page.keyboard.press('PageDown'); await page.keyboard.press('ArrowDown'); log('  PageDown in help scrollTop', await page.evaluate(() => document.querySelector('[data-testid=help]')?.scrollTop))
  await page.keyboard.press('Control+k'); log('Ctrl+K from help: panel', await T.panel(page)); await page.keyboard.press('Escape')
  // ? in prompt / edit mode
  await sel(page, 'R020'); await gotoCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('?')
  log('? in edit mode: panel', await T.panel(page), 'editor', await page.getByTestId('cell-editor').inputValue().catch(() => '-'))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+g'); await page.keyboard.press('?'); log('? in Ctrl+G prompt: panel', await T.panel(page), 'text', await page.getByTestId('prompt-text').inputValue().catch(() => '-')); await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+A'); await page.keyboard.press('?'); log('? in adopt panel:', await T.panel(page), await T.toast(page)); await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+A'); await page.keyboard.press('Control+k'); log('Ctrl+K in adopt panel:', await T.panel(page)); await page.keyboard.press('Escape')
  // Esc 連打の結果
  for (let i = 0; i < 5; i++) await page.keyboard.press('Escape'); log('Esc x5: cursor', await T.cursor(page), 'view', await T.view(page), 'filter', await page.getByTestId('filter').inputValue())
} catch (e) { log('EXC', String(e).slice(0, 400)) }
save(errors)
await browser.close()
