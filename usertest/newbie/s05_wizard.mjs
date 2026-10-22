// S05: 新規BOMガイドで雑な入力（約15人）
import { launch, fresh, T, makeLog, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s05_wizard')
const openWizard = async () => { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
try {
  await fresh(page)
  // A. 全部空欄で Enter 連打
  await openWizard()
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(20) }
  log('A all-empty Enter: panel', await T.panel(page), 'header', (await T.header(page)).slice(0, 120), 'rows', await T.rows(page), 'toast', await T.toast(page), 'view', await T.view(page))
  await shot(page, 's05_empty_project')
  log('projects:', await page.locator('.side .view').filter({ hasNot: page.locator('.k') }).allTextContents())
  // 空案件で Ctrl+Enter / a / n
  await page.keyboard.press('Control+Enter')
  log('empty project Ctrl+Enter:', await T.toast(page))
  await page.keyboard.press('n')
  log('empty project n:', await T.toast(page))
  await page.keyboard.press('Shift+Enter')
  log('empty project Shift+Enter: mode', await T.mode(page), 'cursor', await T.cursor(page), 'rows', await T.rows(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // B. 納期に「来月」、工程日数に「十」、予算に「100万」
  await fresh(page)
  await openWizard()
  await page.getByTestId('wizard-id').fill('P-2026-041') // 既存IDと同じ
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill('テスト')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill('来月')
  await page.keyboard.press('Enter')
  log('B due=来月 step advanced? wizard text:', (await page.getByTestId('wizard').textContent()).slice(0, 60))
  await page.getByTestId('wizard-processDays').fill('十')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-budget').fill('100万')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-buyer').fill('')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter') // 商社なし
  await page.keyboard.press('3') // 1つずつ
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  log('B created: header', (await T.header(page)).slice(0, 160), 'toast', await T.toast(page))
  await shot(page, 's05_due_raigetsu')
  log('B projects:', (await page.locator('.side').textContent()).slice(0, 300))
  const dup = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')).projects.map((p) => p.id + '/' + p.name + '/due=' + p.dueDate + '/pd=' + p.settings.processDays + '/budget=' + p.settings.budget))
  log('B stored projects:', dup)
  await page.keyboard.press('Control+p')
  log('B inbox list:', (await page.getByTestId('inbox').allTextContents()).join(' || ').slice(0, 400))
  await page.keyboard.press('Escape')
  // C. 貼り付け：カンマ区切り、スペース区切り、ヘッダー行付き、列順が違う、Excelの空行
  const cases = {
    comma: '制御,リレー,MY4N-D2 DC24,オムロン,4,個,KA1\n制御,ソケット,PYF14A-E,オムロン,4,個,KA1S',
    header: '分類\t部品名\t型式\tメーカ\t数量\t単位\t回路記号\n制御\tリレー\tMY4N-D2 DC24\tオムロン\t4\t個\tKA1\n\n制御\tソケット\tPYF14A-E\tオムロン\t4\t個\tKA1S\n',
    headerDiffOrder: '部品名\t型式\t数量\tメーカ\n リレー \tMY4N-D2 DC24\t4\tオムロン\nソケット\tPYF14A-E\t4\tオムロン',
    noCategory: 'リレー\tMY4N-D2 DC24\tオムロン\t4\n',
    excelHeaderJp: 'No.\t品名\t形式\tメーカー\t員数\n1\tリレー\tMY4N-D2 DC24\tオムロン\t4\n2\tソケット\tPYF14A-E\tオムロン\t4',
    spaces: 'リレー MY4N-D2 DC24 オムロン 4',
  }
  for (const [name, text] of Object.entries(cases)) {
    await fresh(page)
    await openWizard()
    await page.getByTestId('wizard-id').fill('T-' + name)
    await page.keyboard.press('Enter')
    await page.getByTestId('wizard-name').fill('貼付 ' + name)
    for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1')
    await page.getByTestId('wizard-paste').fill(text)
    await page.keyboard.press('Enter') // textarea 内 Enter → 改行？次へ？
    const stillWizard = await page.getByTestId('wizard').count()
    log(`C[${name}] Enter in textarea -> wizard still open:`, stillWizard, 'textarea value len', stillWizard ? (await page.getByTestId('wizard-paste').inputValue()).length : '-', 'orig', text.length)
    if (stillWizard) { await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter') }
    await page.waitForTimeout(50)
    const rows = await page.evaluate(() => { const ws = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = ws.projects.find((p) => p.id === ws.currentProjectId); return p.rows.map((r) => [r.id, r.category, r.name, r.model, r.maker, r.qtyNeeded, r.unit, r.ref].join('|')) })
    log(`C[${name}] rows:`, rows)
    await shot(page, 's05_paste_' + name)
    log(`C[${name}] lamps`, await page.getByTestId('lamps').textContent(), 'toast', await T.toast(page))
  }
  // D. Esc で中止したい（step>0 では1つ戻るだけ）
  await fresh(page)
  await openWizard()
  await page.getByTestId('wizard-id').fill('X')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  log('D Esc at step3 -> wizard open?', await page.getByTestId('wizard').count(), 'step title', (await page.getByTestId('wizard').textContent().catch(() => '')).slice(0, 20))
  for (let i = 0; i < 5; i++) await page.keyboard.press('Escape')
  log('D after 6 Esc: panel', await T.panel(page))
  // E. 商社選択で Space 連打、ArrowDown で範囲外
  await openWizard()
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  log('E step6 text:', (await page.getByTestId('wizard').textContent()).slice(0, 40))
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space'); await page.keyboard.press('Space'); await page.keyboard.press('Space')
  log('E picks after 3 Space:', (await page.getByTestId('wizard').locator('.check').allTextContents()).join(''))
  // ステップ7で Tab/文字
  await page.keyboard.press('Enter')
  await page.keyboard.press('2')
  log('E step7 choose 2 (ファイル): textarea present', await page.getByTestId('wizard-paste').count())
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  log('E created via option2: rows', await T.rows(page), 'toast', await T.toast(page))
  // F. 同じ案件IDで2回作る → 案件切替の挙動
  await fresh(page)
  for (let n = 0; n < 2; n++) { await openWizard(); await page.getByTestId('wizard-id').fill('DUP-1'); for (let i = 0; i < 9; i++) await page.keyboard.press('Enter'); await page.waitForTimeout(50) }
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')).projects.map((p) => p.id))
  log('F project ids after dup create:', ids)
  await page.locator('.side .view').filter({ hasText: 'P-2026-041' }).first().click().catch(() => {})
  await page.keyboard.press('Control+p')
  log('F inbox:', (await page.getByTestId('inbox').allTextContents()).join(' || ').slice(0, 300))
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  log('F after open 2nd in inbox: header', (await T.header(page)).slice(0, 60), 'rows', await T.rows(page))
  await shot(page, 's05_dup_ids')
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
