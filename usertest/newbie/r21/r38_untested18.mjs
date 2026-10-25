// ラウンド18: 新人がまだ触っていない操作をパレットから探して使う（推奨／最安で一括採用・選定記録・案件設定を確定・行を隠す・ルールを追加・
// サンプルデータに戻す・ダーク／コンパクト・読み込み前に戻す・退避データを消す・行へジャンプ）
import fs from 'node:fs'
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, palette, setRole, store, sel, gotoCol, typeReal, runPalette, clearToast, paletteTop } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r38_untested18')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const pt = async () => ((await T.panelText(page)) ?? '-').slice(0, 300)
const clickOpt = async (label) => { const o = page.locator('.overlay').getByText(label, { exact: false }).last(); if (await o.count()) { await o.click(); return true } return false }
const adoptedSummary = async () => { const p = await proj(page); return p.rows.filter((r) => r.adoptedSupplierId).map((r) => `${r.id}:${r.adoptedSupplierId}:${r.adoptReason ?? ''}${r.flags.pmPending ? '(PM:' + r.flags.pmReason + ')' : ''}`).join(' ') }
const quotedUnadopted = async () => { const p = await proj(page); return p.rows.filter((r) => r.status === 'quoted' && !r.adoptedSupplierId && !['cancelled', 'replaced'].includes(r.status)).map((r) => r.id) }

await step('A0 購買: 推奨で一括採用（選定者は設計）', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  const ok = await runPalette(page, '推奨で一括採用'); await sleep(200)
  log(`  palette ok=${ok} toast: ${await T.toast(page)} | panel ${await pt()}`)
})
await step('A 設計（選定者）: 推奨で一括採用 → 確認で Enter（既定）→ もう一度 → マウスで「n 行を採用する」→ Ctrl+Z', async () => {
  await fresh(page); await sleep(150)
  log('  quoted & 未採用: ' + (await quotedUnadopted()).join(','))
  log('  adopted before: ' + (await adoptedSummary()))
  const ok = await runPalette(page, '推奨で一括採用'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()}`)
  await shot(page, 'r38_A_confirm')
  await page.keyboard.press('Enter'); await sleep(200)
  log(`  Enter -> toast: ${await T.toast(page)} | adopted: ${await adoptedSummary()}`)
  await runPalette(page, '推奨で一括採用'); await sleep(200)
  const c = await clickOpt('行を採用する'); await sleep(300)
  log(`  click=${c} -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  log('  adopted after: ' + (await adoptedSummary()))
  await page.locator('.gridwrap').focus().catch(() => {})
  await page.keyboard.press('Control+z'); await sleep(250)
  log(`  Ctrl+Z -> toast: ${await T.toast(page)} | adopted: ${await adoptedSummary()}`)
})
await step('B 設計（選定者）: 最安で一括採用（スコア無視）→ マウスで採用 → PM の 7 に何が出るか', async () => {
  await fresh(page); await sleep(150)
  const ok = await runPalette(page, '最安で一括採用'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()}`)
  const c = await clickOpt('行を採用する'); await sleep(300)
  log(`  click=${c} -> toast: ${await T.toast(page)}`)
  log('  adopted: ' + (await adoptedSummary()))
  log(`  hints: ${(await T.hints(page)).slice(0, 200)} | status ${(await T.status(page)).replace(/\s+/g, ' ').slice(0, 200)}`)
  await setRole(page, 'pm'); await sleep(200)
  log(`  PM view=${await T.view(page)} rows=${await T.rows(page)} hints=${(await T.hints(page)).slice(0, 160)}`)
  await shot(page, 'r38_B_pm')
})
await step('C 購買: 選定記録を出力（社内）', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  const ok = await runPalette(page, '選定記録を出力'); await sleep(200)
  const d = await dl
  let info = 'no download'
  if (d) { const pth = '/home/user/BOM/usertest/newbie/r21/dl/r38_selection_' + (process.env.REPRO ? 'r2' : 'r1') + '.xlsx'; await d.saveAs(pth); info = `${d.suggestedFilename()} ${fs.statSync(pth).size}B` }
  log(`  palette ok=${ok} download=${info} toast: ${await T.toast(page)}`)
})
await step('D PM: 案件設定を確定（PM）を押してみる → 設計で同じ操作', async () => {
  await fresh(page, 'pm'); await sleep(150)
  const ok = await runPalette(page, '案件設定を確定'); await sleep(250)
  log(`  palette ok=${ok} -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  let p = await proj(page); log(`  pmConfirmed=${p.settings.pmConfirmed} decisions(案件設定確定)=${p.decisions.filter((d) => d.kind === '案件設定確定').length}`)
  await clearToast(page)
  await runPalette(page, '案件設定を確定'); await sleep(250)
  p = await proj(page); log(`  2 回目 -> toast: ${await T.toast(page)} | pmConfirmed=${p.settings.pmConfirmed} decisions(案件設定確定)=${p.decisions.filter((d) => d.kind === '案件設定確定').map((d) => d.reason).join(' / ')}`)
  await setRole(page, 'design'); await sleep(150)
  const ok2 = await runPalette(page, '案件設定を確定'); await sleep(250)
  log(`  design: palette ok=${ok2} -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
})
await step('E 設計: 行を隠す（R003）→ 同じ操作をもう一度（戻すつもり）→ 1 すべて', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R003'); await sleep(100)
  const n0 = await T.rows(page)
  await runPalette(page, '行を隠す'); await sleep(200)
  log(`  hide -> toast: ${await T.toast(page)} | rows ${n0}→${await T.rows(page)} | cursor ${await T.cursor(page)}`)
  await runPalette(page, '行を隠す'); await sleep(200)
  const p = await proj(page)
  log(`  again -> toast: ${await T.toast(page)} | rows=${await T.rows(page)} | hidden=${p.rows.filter((r) => r.hidden).map((r) => r.id).join(',')} | cursor ${await T.cursor(page)}`)
  await page.keyboard.press('Alt+1'); await sleep(200)
  log(`  Alt+1 view=${await T.view(page)} rows=${await T.rows(page)}`)
  await shot(page, 'r38_E_hidden')
})
await step('F 設計: ルールを追加（指摘の無い行の型式の列）→ 選ぶ → R005 の型式に「 MY4N 」と前後に空白', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '型式'); await sleep(100)
  const ok = await runPalette(page, 'ルールを追加'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()} | toast ${await T.toast(page)}`)
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200) }
  log(`  Enter -> toast: ${await T.toast(page)}`)
  const ws = await store(page); log('  rules(added): ' + ws.rules.filter((r) => r.id.startsWith('rule.ws')).map((r) => `${r.name}/${r.severity}/${r.scope}`).join(' '))
})
await step('G 設計: サンプルデータに戻す → 確認で Enter（既定）→ Esc', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R005'); await gotoCol(page, '部品名'); await typeReal(page, 'Test', 20); await page.keyboard.press('Enter'); await sleep(150)
  const ok = await runPalette(page, 'サンプルデータに戻す'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()}`)
  await page.keyboard.press('Enter'); await sleep(200)
  const r = (await proj(page)).rows.find((x) => x.id === 'R005')
  log(`  Enter -> toast: ${await T.toast(page)} | R005 working=${JSON.stringify(r.working)} name=${r.name}`)
})
await step('H ダークモード・コンパクト表示 → リロード', async () => {
  await fresh(page); await sleep(150)
  await runPalette(page, 'ダークモード'); await sleep(150); log(`  theme -> ${await T.toast(page)}`)
  await runPalette(page, 'コンパクト'); await sleep(150); log(`  density -> ${await T.toast(page)}`)
  await shot(page, 'r38_H_dark_compact')
  await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300)
  log(`  after reload theme=${await page.evaluate(() => document.documentElement.dataset.theme)} density=${await page.evaluate(() => document.documentElement.dataset.density)}`)
  await runPalette(page, 'ダークモード'); await sleep(150); await runPalette(page, 'コンパクト'); await sleep(150)
})
await step('I 読み込み前に戻す・退避データを消す・退避したデータを書き出す（何も読み込んでいない）', async () => {
  await fresh(page); await sleep(150)
  for (const c of ['読み込み前に戻す', '退避データを消す', '退避したデータを書き出す']) { const ok = await runPalette(page, c); await sleep(200); log(`  ${c}: ok=${ok} toast ${await T.toast(page)} | panel ${await pt()}`); if (await T.panel(page)) await page.keyboard.press('Escape'); await clearToast(page) }
})
await step('J 行へジャンプ（Ctrl+G）: 小文字の型式・小文字の ID・ない ID・回路記号', async () => {
  await fresh(page); await sleep(150)
  for (const q of ['my4n', 'r007', 'R999', 'h3cr', 'オムロン', '7']) {
    await page.keyboard.press('Control+g'); await sleep(80)
    const ph = await page.getByTestId('prompt-text').getAttribute('placeholder').catch(() => '')
    await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter'); await sleep(200)
    log(`  [${q}] -> cursor ${await T.cursor(page)} | toast ${await T.toast(page)} | panel ${await T.panel(page)} | placeholder ${ph}`)
    if (await T.panel(page)) await page.keyboard.press('Escape')
    await clearToast(page)
  }
})
save(errors); await browser.close()
