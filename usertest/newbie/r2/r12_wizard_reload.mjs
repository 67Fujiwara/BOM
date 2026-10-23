// R12: ガイドを途中でやめる・リロード・2タブ・役割違いでガイド
import { launch, fresh, T, makeLog, shot, sel, store, clearToast, palette, runPalette, setRole, attachErrors } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog('r12_wizard_reload')
const stepTitle = async (pg = page) => (await pg.getByTestId('wizard').locator('h3').textContent().catch(() => '(closed)'))
try {
  await fresh(page)
  // 途中まで → リロード
  await runPalette(page, '新しいBOM')
  await page.getByTestId('wizard-id').fill('R-100'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill('リロード前'); await page.keyboard.press('Enter')
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus()
  await runPalette(page, '新しいBOM')
  log('after reload reopen: step', await stepTitle(), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // 途中で Ctrl+K を押す（ガイド中にパレット）
  await runPalette(page, '新しいBOM'); await page.keyboard.press('Control+k')
  log('Ctrl+K in wizard: panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // ガイド中に ? 
  await runPalette(page, '新しいBOM'); await page.keyboard.press('?')
  log('? in wizard (id input focused): panel', await T.panel(page), 'id value', await page.getByTestId('wizard-id').inputValue().catch(() => '-'))
  await page.keyboard.press('Escape')
  // ガイドの外をクリック
  await runPalette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('CLICKOUT')
  await page.mouse.click(5, 5)
  log('click outside wizard: panel', await T.panel(page), 'toast', await T.toast(page))
  await runPalette(page, '新しいBOM'); log('  reopen id', await page.getByTestId('wizard-id').inputValue().catch(() => '-'), 'step', await stepTitle())
  await page.keyboard.press('Escape')
  // ガイド中にサイドバー/ヘッダーをクリック（オーバーレイで覆われる？）
  // 購買がガイドで BOM を作る
  await fresh(page, 'purchasing')
  await runPalette(page, '新しいBOM')
  log('purchasing opens wizard: panel', await T.panel(page), 'toast', await T.toast(page))
  if (await T.panel(page)) {
    await page.getByTestId('wizard-id').fill('PUR-1'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
    const w = await store(page); const p = w.projects.find((x) => x.id === 'PUR-1')
    log('purchasing created project: members', JSON.stringify(p?.members), 'view', await T.view(page), 'role', await T.role(page), 'rows', await T.rows(page), 'toast', await T.toast(page))
    await page.keyboard.press('Shift+Enter'); log('  purchasing Shift+Enter in own project:', await T.toast(page), 'mode', await T.mode(page))
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); log('  purchasing Enter on row:', await T.toast(page), await T.mode(page))
  }
  // 2 タブ: A でガイド作成中、B で同じ ID を作る
  await fresh(page)
  const p2 = await context.newPage(); attachErrors(p2, errors, 'tab2'); await p2.goto('http://localhost:5173/'); await p2.getByTestId('grid').waitFor(); await p2.locator('.gridwrap').focus()
  await runPalette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('DUP-1'); await page.keyboard.press('Enter')
  await runPalette(p2, '新しいBOM'); await p2.getByTestId('wizard-id').fill('DUP-1'); for (let i = 0; i < 7; i++) await p2.keyboard.press('Enter'); await p2.keyboard.press('3'); await p2.keyboard.press('Enter'); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150)
  log('tab2 created DUP-1:', (await store(p2)).projects.map((x) => x.id))
  await page.bringToFront()
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter'); await page.keyboard.press('3'); await page.keyboard.press('Enter')
  log('tab1 at step', await stepTitle(), 'err', await page.getByTestId('wizard-error').textContent().catch(() => null))
  await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  log('tab1 Enter create: toast', await T.toast(page), 'panel', await T.panel(page), 'projects', (await store(page)).projects.map((x) => x.id))
  await page.keyboard.press('Escape')
  await p2.reload(); await p2.getByTestId('grid').waitFor()
  log('tab2 reload: projects', (await store(p2)).projects.map((x) => x.id), 'crash', await T.crash(p2))
  // サンプルに戻す in tab1 while tab2 editing
  await p2.locator('.gridwrap').focus(); await p2.keyboard.press('Control+p'); await p2.keyboard.press('Enter')
  await sel(p2, 'R001').catch(() => {})
  await page.bringToFront(); await page.locator('.gridwrap').focus()
  await runPalette(page, 'サンプル', 'サンプルデータに戻す'); await page.keyboard.press('2'); await page.waitForTimeout(150)
  log('tab1 reset: projects', (await store(page)).projects.map((x) => x.id))
  await p2.bringToFront(); await p2.waitForTimeout(200)
  log('tab2 after tab1 reset: header', (await T.header(p2)).slice(0, 40), 'side', (await p2.getByTestId('side').innerText()).replace(/\s+/g, ' ').slice(-120))
  await p2.locator('.gridwrap').focus(); await p2.keyboard.press('Control+z')
  log('tab2 Ctrl+Z after reset in tab1:', await T.toast(p2), 'projects', (await store(p2)).projects.map((x) => x.id))
  await p2.close()
} catch (e) { log('EXC', String(e).slice(0, 400)) }
save(errors)
await browser.close()
