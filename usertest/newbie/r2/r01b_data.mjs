// R01: 前回 N-01/02/06/07/10/13/18/19/23/24/28, U-06/07/15/18/21 の再確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, runPalette } from './lib.mjs'
import fs from 'node:fs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r01b_data')
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
const stepTitle = async () => (await page.getByTestId('wizard').locator('h3').textContent().catch(() => '(closed)'))
const werr = async () => (await page.getByTestId('wizard-error').count()) ? page.getByTestId('wizard-error').textContent() : null
try {
  // N-02 JSON 不完全
  await fresh(page)
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await runPalette(page, 'JSON を書き出す')
  const d = await dl
  let json = ''
  if (d) json = fs.readFileSync(await d.path(), 'utf8')
  log('U-18 export: file', d?.suggestedFilename(), 'toast', await T.toast(page))
  const bad = {
    partial: '{"projects":[{"id":"x","name":"壊れた"}],"currentProjectId":"x"}',
    rowsBroken: '{"projects":[{"id":"x","name":"壊れた","rows":[{"id":"R1"}]}],"currentProjectId":"x"}',
    rowsNull: '{"projects":[{"id":"x","name":"n","rows":[null,1,"a"]}],"currentProjectId":"x"}',
    issuesBroken: '{"projects":[{"id":"x","name":"n","rows":[],"issues":[{"id":"I-1","rowId":"R9"}]}]}',
    invalid: 'これはJSONではない', empty: '', array: '[]', noprojects: '{"a":1}', emptyProjects: '{"projects":[]}',
    valid: json,
  }
  for (const [name, text] of Object.entries(bad)) {
    await runPalette(page, 'JSON を読み込む')
    await page.getByTestId('import-text').fill(text)
    await page.keyboard.press('Control+Enter'); await page.waitForTimeout(200)
    log(`N-02 import[${name}]: crash`, await T.crash(page), 'grid', await page.getByTestId('grid').count(), 'panel', await T.panel(page), 'toast', await T.toast(page), 'rows', await T.rows(page))
    if (await T.crash(page) || !(await page.getByTestId('grid').count())) {
      await shot(page, 'r01_import_crash_' + name)
      await page.reload(); await page.waitForTimeout(600)
      log('  after reload grid', await page.getByTestId('grid').count(), 'crash', await T.crash(page))
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.reload(); await page.getByTestId('grid').waitFor()
    } else {
      // reload to check persisted
      await page.reload(); await page.waitForTimeout(400)
      log('  reload ok grid', await page.getByTestId('grid').count(), 'crash', await T.crash(page), 'header', (await T.header(page).catch(() => '-')).slice(0, 50))
      if (!(await page.getByTestId('grid').count())) { await shot(page, 'r01_import_reload_crash_' + name); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.reload(); await page.getByTestId('grid').waitFor() }
    }
    await page.locator('.gridwrap').focus()
  }
  // 壊れた localStorage
  for (const [name, raw] of [['garbage', '{{{'], ['partial', '{"projects":[{"id":"x"}],"currentProjectId":"x"}'], ['nullRows', '{"projects":[{"id":"x","name":"a","rows":null}]}']]) {
    await page.evaluate(([raw]) => localStorage.setItem('bom-pro.workspace.v2', raw), [raw])
    await page.reload(); await page.waitForTimeout(500)
    log(`broken storage ${name}: grid`, await page.getByTestId('grid').count(), 'crash', await T.crash(page), 'toast', await T.toast(page), 'header', (await T.header(page).catch(() => '-')).slice(0, 40))
  }
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.reload(); await page.getByTestId('grid').waitFor()
  // N-18 / U-15 サンプルに戻す
  await fresh(page)
  await sel(page, 'R030'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
  await runPalette(page, 'サンプル', 'サンプルデータに戻す')
  log('U-15 reset prompt:', await T.panelText(page))
  await page.keyboard.press('Enter')
  log('U-15 reset Enter: R030', await T.cell(page, 'R030', 'model'), 'toast', await T.toast(page))
  await runPalette(page, 'サンプル', 'サンプルデータに戻す'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  log('U-15 reset ↓Enter: R030', await T.cell(page, 'R030', 'model'), 'toast', await T.toast(page))
  await page.keyboard.press('Control+z')
  log('N-18 Ctrl+Z after reset:', await T.toast(page), 'R030', await T.cell(page, 'R030', 'model'))
  // N-13 役割プロンプトに氏名欄
  await fresh(page)
  await runPalette(page, '役割', '役割を切り替え')
  log('N-13 role prompt text input', await page.getByTestId('prompt-text').count(), await T.panelText(page))
  await page.keyboard.press('ArrowDown')
  await page.getByTestId('prompt-text').fill('新人 太郎').catch(() => {})
  await page.keyboard.press('Enter')
  log('N-13 after: role', await T.role(page), 'role-status', await page.getByTestId('role-status').textContent(), 'view', await T.view(page))
  // 数字キーで役割を選ぼうとする（新人）
  await runPalette(page, '役割', '役割を切り替え'); await page.keyboard.press('3')
  log('role prompt press 3: panel', await T.panel(page), 'text', await page.getByTestId('prompt-text').inputValue().catch(() => '-'))
  await page.keyboard.press('Enter')
  log('role prompt 3 Enter: role', await T.role(page), 'role-status', await page.getByTestId('role-status').textContent())
  // U-15 正式見積
  await fresh(page, 'purchasing')
  await runPalette(page, '正式見積', '正式見積を依頼')
  log('U-15 formal prompt:', await T.panel(page), await T.panelText(page))
  await page.keyboard.press('Enter')
  log('U-15 formal Enter:', await T.toast(page), 'panel', await T.panel(page))
  // U-18 Excel
  await clearToast(page)
  const dl2 = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.keyboard.press('Control+e'); await page.waitForTimeout(100)
  log('U-18 Ctrl+E panel', await T.panelText(page))
  await page.keyboard.press('Enter')
  const d2 = await dl2
  await page.waitForTimeout(300)
  log('U-18 excel download', d2?.suggestedFilename(), 'toast', await T.toast(page))
} catch (e) { log('EXC', String(e).slice(0, 500)) }
save(errors)
await browser.close()
