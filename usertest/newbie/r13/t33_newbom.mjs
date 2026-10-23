// 設計の新人: 新しい BOM（貼り付け：表題・合計・エラーのセル・小文字の回路記号）→ 案内どおりに直す → 公開
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t33_newbom')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const dump = async (tag) => { const p = await proj(page); log(`  ${tag}: ${p.id} rows=${p.rows.length} ` + p.rows.map((r) => `${r.id}{${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}|${r.status}}`).join(' ')) }
await fresh(page)
const tsv = [
  '部品表\t\t\t\t\t',
  '案件\t第4ライン制御盤\t\t作成\t山田\t',
  '',
  '記号\t品名\t形式\tメーカー\t員数\t備考',
  'k1\tリレー\tMY4N-D2 DC24\tオムロン\t4\t',
  'cb1\tブレーカ\tNF32-SV 2P 10A\t三菱電機\t1\t',
  'f1\tヒューズ\t#REF!\t\t2\t',
  't1\tタイマ\tH3CR-A8\tオムロン\t#N/A\t',
  'x1\t端子台\tXW2B-20G4\tomron\t3\t',
  '\t合計\t\t\t10\t',
].join('\n')
await step('ウィザード', async () => {
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(80); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill('L4-2026'); await page.keyboard.press('Enter'); await sleep(60)
  log('  step2', (await T.panelText(page))?.slice(0, 200))
  // 案件名（IME の代わりに insertText）
  await page.keyboard.insertText('第4ライン制御盤'); await page.keyboard.press('Enter'); await sleep(60)
  log('  step3', (await T.panelText(page))?.slice(0, 200))
  await typeReal(page, '2026/12/20'); await page.keyboard.press('Enter'); await sleep(60); log('  after due', (await T.panelText(page))?.slice(0, 200), await T.toast(page))
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(60); log('  Enter ->', (await T.panelText(page))?.slice(0, 160)) }
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(tsv); await sleep(50)
  await page.keyboard.press('Enter'); await sleep(50) // 新人は Enter（貼り付け欄では改行）
  log('  Enter in textarea ->', (await T.panelText(page))?.slice(0, 120))
  await page.keyboard.press('Control+Enter'); await sleep(150)
  log('  confirm:', (await T.panelText(page))?.slice(0, 900)); await shot(page, 't33_confirm')
  await page.keyboard.press('Enter'); await sleep(300); await state('created'); await dump('created')
  await shot(page, 't33_created')
})
await step('作成直後: 案内どおり n', async () => {
  const before = JSON.stringify((await proj(page)).rows)
  await page.keyboard.press('n'); await sleep(100); await state('n'); await page.keyboard.press('Escape'); await sleep(80); await state('Esc')
  log('  unchanged after Esc:', before === JSON.stringify((await proj(page)).rows))
})
await step('公開を試す → 案内を読む', async () => {
  await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter'); log('  panel', (await T.panelText(page))?.slice(0, 200))
  if (await T.panel(page)) await page.keyboard.press('Escape')
})
await step('F8 で問題を回り、打って直す', async () => {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('F8'); await sleep(120); const u = await ui(page)
    const status = (await T.status(page)).replace(/\s+/g, ' ').slice(0, 220)
    log(`  F8#${i}: ${u.cursorRow}/${u.cursorCol} | ${status}`)
  }
})
await step('順番に直すモード Ctrl+Shift+F', async () => {
  await page.keyboard.press('Control+Shift+F'); await sleep(200); await state('seq'); log('  panel', (await T.panelText(page))?.slice(0, 300))
  for (let i = 0; i < 8 && (await T.panel(page)); i++) {
    const pt = (await T.panelText(page)) ?? ''
    const u = await ui(page)
    log(`  seq#${i} ${u.cursorRow}/${u.cursorCol}: ${pt.slice(0, 220)}`)
    await page.keyboard.press('Enter'); await sleep(120)
    const u2 = await ui(page)
    if (u2.mode === 'edit') {
      const col = u2.cursorCol
      const v = col === 'maker' ? 'Littelfuse' : col === 'model' ? '0218002.MXP' : col === 'qtyNeeded' ? '2' : 'X'
      await page.keyboard.press('Control+a'); await typeReal(page, v, 20); await page.keyboard.press('Enter'); await sleep(200)
      log(`    typed ${v} into ${u2.cursorRow}/${col} -> toast ${await T.toast(page)}`)
    }
  }
  await state('seq end'); await dump('after seq')
})
await step('公開', async () => {
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter')
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { log('  panel', (await T.panelText(page))?.slice(0, 260)); await page.keyboard.press('Enter'); await sleep(200); await state('Enter') }
  await dump('after publish'); await shot(page, 't33_published')
})
save(errors); await browser.close()
