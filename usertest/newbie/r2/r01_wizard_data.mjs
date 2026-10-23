// R01: 前回 N-01/02/06/07/10/13/18/19/23/24/28, U-06/07/15/18/21 の再確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette } from './lib.mjs'
import fs from 'node:fs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r01_wizard_data')
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
const stepTitle = async () => (await page.getByTestId('wizard').locator('h3').textContent().catch(() => '(closed)'))
const werr = async () => (await page.getByTestId('wizard-error').count()) ? page.getByTestId('wizard-error').textContent() : null
try {
  // N-01 予算 100万
  await fresh(page)
  await openWizard()
  await page.getByTestId('wizard-id').fill('B-1'); await page.keyboard.press('Enter')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-budget').fill('100万'); await page.keyboard.press('Enter')
  log('N-01 budget 100万 -> step', await stepTitle(), 'err', await werr())
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  log('N-01 step7?', await stepTitle(), 'active', await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('data-testid')))
  await page.keyboard.press('1')
  await page.waitForTimeout(50)
  log('N-06 after 1 active', await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('data-testid')))
  await page.keyboard.type('制御\tリレー\tMY4N\tオムロン\t2\t個\tKA1')
  await page.keyboard.press('Control+Enter')
  log('N-01 preview:', (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 300))
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  log('N-01 created: crash', await T.crash(page), 'money', await page.getByTestId('money').textContent().catch(() => '-'), 'toast', await T.toast(page))
  const w1 = await store(page); const p1 = w1.projects.find((p) => p.id === 'B-1'); log('N-01 stored budget', p1?.settings.budget)
  await shot(page, 'r01_budget_100man')
  // 予算 その他の雑な入力
  for (const b of ['abc', '-5', '１２０万円', '2,800,000', '1e3', '三百万']) {
    await fresh(page); await openWizard()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
    await page.getByTestId('wizard-budget').fill(b); await page.keyboard.press('Enter')
    log(`budget "${b}" -> step`, await stepTitle(), 'err', await werr())
    await page.keyboard.press('Escape')
  }
  // N-10 納期 来月 / 工程日数 十
  for (const d of ['来月', '11/30', '2026/12/1', '12月1日', '未定', 'みてい', '2025-01-01', '2026-13-01', '令和8年12月1日']) {
    await fresh(page); await openWizard()
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
    await page.getByTestId('wizard-due').fill(d); await page.keyboard.press('Enter')
    log(`due "${d}" -> step`, await stepTitle(), 'err', await werr())
    await page.keyboard.press('Escape')
  }
  for (const d of ['十', '１０', '10日', '-1', '1.5', '400']) {
    await fresh(page); await openWizard()
    for (let i = 0; i < 3; i++) await page.keyboard.press('Enter')
    await page.getByTestId('wizard-processDays').fill(d); await page.keyboard.press('Enter')
    log(`processDays "${d}" -> step`, await stepTitle(), 'err', await werr())
    await page.keyboard.press('Escape')
  }
  // N-07 既存 ID
  await fresh(page); await openWizard()
  for (const id of ['P-2026-041', 'p-2026-041', 'Ｐ－２０２６－０４１', 'テスト案件', 'A B']) {
    await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter')
    log(`id "${id}" -> step`, await stepTitle(), 'err', await werr())
    if ((await stepTitle()) !== '案件ID') await page.keyboard.press('Alt+ArrowLeft')
  }
  await page.keyboard.press('Escape')
  // N-06 ステップ7 で 3 → Enter
  await fresh(page); await openWizard()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  log('N-06 step', await stepTitle())
  await page.keyboard.press('3'); await page.keyboard.press('Enter')
  log('N-06 3,Enter -> step', await stepTitle(), 'err', await werr())
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const w6 = await store(page)
  log('N-06 created:', w6.projects.map((p) => `${p.id}/${p.name}/rows=${p.rows.length}`), 'view', await T.view(page), 'rows shown', await T.rows(page), 'toast', await T.toast(page))
  await shot(page, 'r01_n06_after_create')
  // U-19 空案件で n / Ctrl+Enter
  await clearToast(page)
  await page.keyboard.press('n'); log('U-19 empty proj n:', await T.toast(page))
  await clearToast(page)
  await page.keyboard.press('Control+Enter'); log('U-19 empty proj Ctrl+Enter:', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // N-06 step 7 で Enter のみ（貼り付けなし）
  await fresh(page); await openWizard()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  log('N-06 step7 Enter without choosing -> step', await stepTitle(), 'err', await werr())
  await page.keyboard.press('2'); await page.waitForTimeout(50)
  log('N-06 2 -> active', await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('data-testid')))
  await page.keyboard.press('Enter')
  log('N-06 file mode Enter w/o file -> step', await stepTitle(), 'err', await werr())
  await page.keyboard.press('Escape')
  // N-24 Esc
  await fresh(page); await openWizard()
  await page.getByTestId('wizard-id').fill('X-9'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill('途中まで'); await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  log('N-24 Esc at step3: panel', await T.panel(page), 'toast', await T.toast(page))
  await openWizard()
  log('U-21 reopen: step', await stepTitle(), 'values', await page.getByTestId('wizard').innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 120)))
  await page.keyboard.press('Alt+ArrowLeft'); await page.keyboard.press('Alt+ArrowLeft')
  log('U-21 back to id value', await page.getByTestId('wizard-id').inputValue().catch(() => '-'))
  await page.keyboard.press('Escape')
  // 受信箱の「＋新しいBOM」からも続き？
  await page.keyboard.press('Control+p'); await page.waitForTimeout(50)
  log('inbox text', (await T.panelText(page)))
  await page.keyboard.press('Escape')
  // N-28 / N-19 / U-07 paste
  const cases = {
    excelHeaderJp: 'No.\t品名\t形式\tメーカー\t員数\n1\tリレー\tMY4N-D2 DC24\tオムロン\t4\n2\tソケット\tPYF14A-E\tオムロン\t4',
    comma: '制御,リレー,MY4N-D2 DC24,オムロン,4,個,KA1\n制御,ソケット,PYF14A-E,オムロン,4,個,KA1S',
    noCategory: 'リレー\tMY4N-D2 DC24\tオムロン\t4\n',
    qtyText: '制御\tリレー\tMY4N-D2 DC24\tオムロン\t十\t個\tKA1\n制御\tソケット\tPYF14A-E\tオムロン\t0\t個\tKA1S\n制御\tヒューズ\tF1\t富士\t１０\t個\tF1',
    spaces: 'リレー MY4N-D2 DC24 オムロン 4',
    headerEn: 'Part\tModel\tMaker\tQty\nRelay\tMY4N\tOmron\t4',
    headerMixed: '品番\t品名\tメーカ名\t数量\t備考\nMY4N-D2\tリレー\tオムロン\t4\t至急',
    quoted: '"制御","リレー","MY4N-D2, DC24","オムロン","4"',
  }
  for (const [name, text] of Object.entries(cases)) {
    await fresh(page); await openWizard()
    await page.getByTestId('wizard-id').fill('T-' + name); await page.keyboard.press('Enter')
    for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1')
    await page.getByTestId('wizard-paste').fill(text)
    await page.keyboard.press('Control+Enter')
    log(`paste[${name}] preview:`, (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 400))
    await shot(page, 'r01_paste_' + name)
    await page.keyboard.press('Enter'); await page.waitForTimeout(80)
    const w = await store(page); const p = w?.projects.find((p) => p.id === w.currentProjectId)
    log(`paste[${name}] rows:`, p?.rows.map((r) => [r.id, r.category, r.name, r.model, r.maker, r.qtyNeeded, r.unit, r.ref].join('|')), 'toast', await T.toast(page), 'view', await T.view(page), 'shown', await T.rows(page))
  }
  // N-02 JSON 不完全
  await fresh(page)
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await palette(page, 'JSON を書き出す'); await page.keyboard.press('Enter')
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
    await palette(page, 'JSON を読み込む'); await page.keyboard.press('Enter')
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
  await palette(page, 'サンプル'); await page.keyboard.press('Enter')
  log('U-15 reset prompt:', await T.panelText(page))
  await page.keyboard.press('Enter')
  log('U-15 reset Enter: R030', await T.cell(page, 'R030', 'model'), 'toast', await T.toast(page))
  await palette(page, 'サンプル'); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  log('U-15 reset ↓Enter: R030', await T.cell(page, 'R030', 'model'), 'toast', await T.toast(page))
  await page.keyboard.press('Control+z')
  log('N-18 Ctrl+Z after reset:', await T.toast(page), 'R030', await T.cell(page, 'R030', 'model'))
  // N-13 役割プロンプトに氏名欄
  await fresh(page)
  await palette(page, '役割'); await page.keyboard.press('Enter')
  log('N-13 role prompt text input', await page.getByTestId('prompt-text').count(), await T.panelText(page))
  await page.keyboard.press('ArrowDown')
  await page.getByTestId('prompt-text').fill('新人 太郎').catch(() => {})
  await page.keyboard.press('Enter')
  log('N-13 after: role', await T.role(page), 'role-status', await page.getByTestId('role-status').textContent(), 'view', await T.view(page))
  // 数字キーで役割を選ぼうとする（新人）
  await palette(page, '役割'); await page.keyboard.press('Enter'); await page.keyboard.press('3')
  log('role prompt press 3: panel', await T.panel(page), 'text', await page.getByTestId('prompt-text').inputValue().catch(() => '-'))
  await page.keyboard.press('Enter')
  log('role prompt 3 Enter: role', await T.role(page), 'role-status', await page.getByTestId('role-status').textContent())
  // U-15 正式見積
  await fresh(page, 'purchasing')
  await palette(page, '正式見積'); await page.keyboard.press('Enter')
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
