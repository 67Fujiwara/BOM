// ラウンド19: U18-04 の直し（案件設定を確定の知らせ・2 回目は断る）を新しい BOM で。設計がガイドで作って公開 → PM の新人が 7 の
// 「案件設定確定」の行で y → もう一度 y → パレットからも → 知らせのとおり Ctrl+K「案件設定」で納期を変える → 購買・設計の画面に「伝わる」か
import { launch, T, makeLog, ui, sleep, shot, proj, palette, setRole, runPalette, clearToast } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r44_settings_confirm19')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const head = async () => (await page.getByTestId('header').innerText()).replace(/\s+/g, ' ').slice(0, 260)
const chips = async () => (await page.locator('.chip').allInnerTexts()).join(' | ')
const st = async (tag) => { const u = await ui(page); const p = await proj(page); log(`  [${tag}] role=${u.role} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | pmConfirmed=${p.settings.pmConfirmed} due=${p.dueDate} cases=${JSON.stringify(p.caseDecisions.map((c) => c.kind + ':' + c.status))} decisions=${p.decisions.filter((d) => /案件設定/.test(d.kind)).map((d) => d.kind + '/' + d.reason).join(' ; ')} | toast=${(await T.toast(page))?.slice(0, 200)} | chips=${await chips()}`) }
await step('A 設計: ガイドで貼り付けて作り、公開（Rev.1）', async () => {
  await wizardPaste(page, '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2')
  await page.keyboard.press('Enter'); await sleep(350)
  await page.keyboard.press('Control+Enter'); await sleep(350)
  if (await T.panel(page)) { log('  panel: ' + (await T.panelText(page))); await page.keyboard.press('Escape') }
  await st('design published')
  log('  header: ' + (await head()))
})
await step('B PM: 7 要決定 → 先頭の行（案件設定確定）で y → もう一度 y', async () => {
  await setRole(page, 'pm'); await sleep(250)
  await st('pm start')
  log('  rows in view: ' + (await page.getByTestId('row').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 80)).join(' / '))
  log('  hints: ' + (await T.hints(page)).slice(0, 200))
  await page.keyboard.press('ArrowDown'); await sleep(150); await st('↓')
  log('  hints: ' + (await T.hints(page)).slice(0, 200))
  await clearToast(page)
  await page.keyboard.press('y'); await sleep(250); await st('y 1')
  await shot(page, 'r44_after_y')
  await clearToast(page)
  await page.keyboard.press('y'); await sleep(250); await st('y 2')
  log('  rows in view: ' + (await page.getByTestId('row').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 80)).join(' / '))
  await clearToast(page)
  log('  ステータスバーの案内のとおり Alt+y・Enter（案件設定を開く）も')
  await page.keyboard.press('Alt+y'); await sleep(250); await st('Alt+y')
  await clearToast(page)
  await page.keyboard.press('Enter'); await sleep(250); await st('Enter'); log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 160))
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
  await page.keyboard.press('Shift+Y'); await sleep(250); await st('Shift+Y')
  await clearToast(page)
  log('  palette: ' + (await runPalette(page, '案件設定を確定'))); await sleep(250); await st('palette 案件設定を確定')
  await clearToast(page)
  log('  palette again: ' + (await runPalette(page, '案件設定を確定'))); await sleep(250); await st('palette 2 回目')
})
await step('C PM: 知らせのとおり Ctrl+K「案件設定」→ 案件納期を 2026-12-25 に → Ctrl+Enter → 理由 → Enter', async () => {
  await palette(page, '案件設定'); await page.keyboard.press('Enter'); await sleep(250)
  log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 300))
  const items = await page.getByTestId('settings').locator('.opt').allTextContents()
  const i = items.findIndex((t) => t.includes('案件納期'))
  log(`  案件納期 index=${i}`)
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await sleep(120)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText('2026-12-25'); await page.keyboard.press('Enter'); await sleep(200)
  await page.keyboard.press('Control+Enter'); await sleep(300)
  log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 300))
  for (let n = 0; n < 4 && (await T.panel(page)); n++) {
    if ((await ui(page)).panel === 'prompt') await page.keyboard.insertText('客先の納期変更')
    await page.keyboard.press('Enter'); await sleep(300)
    log(`  Enter ${n}: panel=${((await T.panelText(page)) ?? '-').slice(0, 200)} | toast=${await T.toast(page)}`)
  }
  await st('settings changed')
})
await step('D 購買・設計: 「購買・設計に伝わります」はどこに出ているか（ヘッダー・受信箱・ステータスバー）', async () => {
  for (const r of ['purchasing', 'design']) {
    await setRole(page, r); await sleep(250)
    await st(r)
    log('  header: ' + (await head()))
    log('  hints: ' + (await T.hints(page)).slice(0, 200))
    await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(200)
    log('  inbox: ' + ((await page.getByTestId('inbox').innerText().catch(() => '-')).split('\n').filter(Boolean).join(' / ').slice(0, 400)))
    await page.keyboard.press('Escape'); await sleep(100)
    await palette(page, '履歴'); await page.keyboard.press('Enter'); await sleep(200)
    log('  history: ' + ((await T.panelText(page)) ?? '-').slice(0, 300))
    await page.keyboard.press('Escape'); await sleep(100)
  }
})
await shot(page, 'r44_end')
save(errors); await browser.close()
