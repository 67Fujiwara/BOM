// R11: 購買の新人（パレット頼み・順番違い・雑な入力）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, paletteTop, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r11_purchasing')
const issuesOf = async () => (await store(page))?.projects[0].issues.map((i) => `${i.id}:${i.rowId}:${i.field ?? '-'}:${i.kind}:${i.status}`)
try {
  await fresh(page, 'purchasing')
  log('purchasing initial view', await T.view(page), 'rows', await T.rows(page))
  // 下書きを 2 件起票
  await page.keyboard.press('1')
  await sel(page, 'R040'); await page.keyboard.press('Shift+I'); await page.keyboard.press('q'); await page.getByTestId('issue-text').fill('取付ネジは付属しますか'); await page.keyboard.press('Enter')
  await sel(page, 'R041'); await page.keyboard.press('Shift+I'); await page.keyboard.press('m'); await page.getByTestId('issue-text').fill('メーカを書いてください'); await page.keyboard.press('Enter')
  log('drafts', await issuesOf())
  // 「指摘」を探す（さらに起票したいつもり）→ Enter
  await palette(page, '指摘'); log('palette 指摘 top', await paletteTop(page, 3))
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  log('palette 指摘 Enter: panel', await T.panelText(page), 'toast', await T.toast(page), 'issues', await issuesOf())
  await shot(page, 'r11_palette_shiteki_enter')
  await page.keyboard.press('Escape')
  // 発行後に Ctrl+Z
  await page.keyboard.press('Control+z'); log('Ctrl+Z after publish:', await T.toast(page), 'issues', await issuesOf())
  // 順番違い: 概算見積を依頼（対象なし）
  await clearToast(page)
  await runPalette(page, '概算見積を依頼'); log('quotes.request panel:', await T.panelText(page))
  await page.keyboard.type('来週'); await page.keyboard.press('Enter'); log('  deadline 来週:', await T.toast(page))
  await runPalette(page, '概算見積を依頼'); await page.keyboard.press('Enter'); await page.waitForTimeout(300); log('  deadline empty Enter:', await T.toast(page))
  // 見積回答を取り込む（ゴミ）
  await clearToast(page)
  await runPalette(page, '見積回答を取り込む'); log('import prompt:', await T.panelText(page))
  await page.keyboard.press('Enter'); log('  after choose supplier:', await T.panelText(page))
  await page.getByTestId('import-text').fill('R020\t12000\t10\nR999\tabc\t\n\nこんにちは'); await page.keyboard.press('Enter')
  log('  Enter in import (newline?):', await T.panel(page), JSON.stringify(await page.getByTestId('import-text').inputValue().catch(() => '-')))
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  log('  Ctrl+Enter import garbage:', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // 正式見積を依頼（選定者でない購買）
  await clearToast(page)
  await runPalette(page, '正式見積を依頼'); log('formal prompt', await T.panelText(page)); await page.keyboard.press('2'); await page.waitForTimeout(300)
  log('  formal 2:', await T.toast(page), 'panel', await T.panel(page))
  // a を押す（購買は選定者ではない）
  await clearToast(page); await page.keyboard.press('1'); await sel(page, 'R020'); await page.keyboard.press('a'); log('purchasing a on R020:', await T.toast(page))
  // 単価セルを Enter で入れる（購買の列）
  const cols = await page.evaluate(() => [...document.querySelectorAll('thead th')].map((t) => t.textContent.trim()))
  log('purchasing columns', cols.join('|'))
  // 発注 o / 入荷 i を選定済でない行に
  await clearToast(page); await sel(page, 'R020'); await page.keyboard.press('o'); log('o on 見積済 R020:', await T.toast(page))
  await clearToast(page); await sel(page, 'R001'); await page.keyboard.press('o'); log('o on 選定済 R001:', await T.toast(page), await T.rowText(page, 'R001'))
  await clearToast(page); await page.keyboard.press('i'); log('i on R001:', await T.toast(page), await T.rowText(page, 'R001'))
  await clearToast(page); await page.keyboard.press('o'); log('o again on R001:', await T.toast(page), await T.rowText(page, 'R001'))
  // x の連打
  await clearToast(page); await sel(page, 'R016'); for (let i = 0; i < 3; i++) { await page.keyboard.press('x'); log(`x #${i + 1} R016:`, await T.toast(page)) }
  // Shift+X（差戻し）理由空
  await page.keyboard.press('Shift+X'); log('Shift+X R016:', await T.panelText(page), await T.toast(page)); await page.keyboard.press('Enter'); log('  Enter empty:', await T.toast(page), await T.panel(page)); await page.keyboard.press('Escape')
  // Shift+R 返信
  await page.keyboard.press('Shift+R'); log('Shift+R R016:', await T.panelText(page)); await page.keyboard.press('Escape')
  // 商社を追加（雑）
  await runPalette(page, '商社を追加'); await page.keyboard.press('Enter'); log('supplier add empty Enter:', await T.toast(page), await T.panel(page)); await page.keyboard.press('Escape')
  await runPalette(page, '商社を追加'); await page.getByTestId('prompt-text').fill('  '); await page.keyboard.press('Enter'); log('supplier add spaces:', await T.toast(page), await T.panel(page)); await page.keyboard.press('Escape')
  const sups = (await store(page))?.suppliers?.map((s) => s.id + ':' + JSON.stringify(s.name))
  log('suppliers', sups)
  // 9 ビュー行と Ctrl+.
  await page.keyboard.press('9'); await page.keyboard.press('ArrowDown'); log('view9 first', await T.cursor(page), 'hints', await T.hints(page))
  await page.keyboard.press('Control+.'); log('Ctrl+. on view9 row:', await T.panelText(page), await T.toast(page)); await page.keyboard.press('Escape')
  // 案件設定 購買項目
  await runPalette(page, '案件設定'); log('settings (purchasing):', await T.panelText(page))
  await shot(page, 'r11_settings_purch')
  for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowDown') }
  await page.keyboard.press('Enter'); log('  Enter on last field:', await T.toast(page), 'editing', await page.getByTestId('settings-input').count())
  if (await page.getByTestId('settings-input').count()) { await page.getByTestId('settings-input').fill('あいう'); await page.keyboard.press('Enter'); log('  あいう Enter:', await T.toast(page), await T.panelText(page)) }
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); log('  after Esc Esc panel', await T.panel(page))
} catch (e) { log('EXC', String(e).slice(0, 400)) }
save(errors)
await browser.close()
