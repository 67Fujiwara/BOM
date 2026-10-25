// ラウンド17: 新人がまだ触っていない操作をパレットから探して使う（商社を追加・休日・先行発注を申請・履歴・やり直す（Ctrl+Y）・商社を集約）と、
// N16-06 の直し（案件設定のほかの変更は理由を入れて確定したときにまとめて保存）の周り（担当者だけ・担当者＋案件名＋理由）
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, palette, setRole, store, sel, gotoCol, typeReal, runPalette, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r26_explore17')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const pt = async () => ((await T.panelText(page)) ?? '-').slice(0, 260)
async function openSettings() { await palette(page, '案件設定'); await page.keyboard.press('Enter'); await sleep(200) }
async function editField(label, val) {
  const items = await page.getByTestId('settings').locator('.opt').allTextContents()
  const i = items.findIndex((t) => t.includes(label))
  const cur = await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().panel.index })
  for (let k = cur; k < i; k++) await page.keyboard.press('ArrowDown')
  for (let k = cur; k > i; k--) await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText(val); await page.keyboard.press('Enter'); await sleep(200)
  log(`  [${label} ← ${val}] toast: ${(await T.toast(page))?.slice(0, 200)} | panel ${(await pt()).slice(0, 120)}`)
}
const pinfo = async () => { const p = await proj(page); return `name=「${p.name}」 members=${JSON.stringify(p.members)} holidays=${JSON.stringify(p.settings.holidays)} budget=${p.settings.budget}` }

await step('A 購買: 商社を追加 → マルツ → もう一度 マルツ → 「（株）マルツ」', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  for (const n of ['マルツ', 'マルツ', '（株）マルツ']) {
    await clearToast(page)
    const ok = await runPalette(page, '商社を追加'); await sleep(150)
    log(`  palette ok=${ok} panel: ${await pt()}`)
    await page.keyboard.insertText(n); await page.keyboard.press('Enter'); await sleep(250)
    log(`  ${n} -> toast: ${await T.toast(page)} | panel ${(await pt()).slice(0, 80)}`)
    if (await T.panel(page)) await page.keyboard.press('Escape')
  }
  const ws = await store(page); log('  suppliers: ' + ws.suppliers.map((s) => `${s.id}:${s.name}`).join(' '))
})
await step('B 購買: 案件設定 → 休日に Excel の書き方（12/29〜1/3・年末年始）→ 直して Ctrl+Enter', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  await openSettings(); log('  panel: ' + (await pt()))
  await editField('休日', '12/29〜1/3')
  // 止められたら欄はそのまま（編集中）。Excel のように全部選んで打ち直す
  await page.keyboard.press('Control+a'); await page.keyboard.insertText('12/29,12/30,12/31,1/2,1/3'); await page.keyboard.press('Enter'); await sleep(200)
  log(`  [直して Enter] toast: ${(await T.toast(page))?.slice(0, 160)} | panel ${(await pt()).slice(0, 60)}`)
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  Ctrl+Enter -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.insertText('年末年始の休み'); await page.keyboard.press('Enter'); await sleep(250); log(`  理由 Enter -> toast: ${await T.toast(page)} | panel ${await pt()}`) }
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  log('  ' + (await pinfo()))
})
await step('C 購買: 見積済の行で 先行発注を申請 → 理由を打って Enter（金額は出たまま）→ PM で見る', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  await sel(page, 'R010'); await sleep(100)
  const ok = await runPalette(page, '先行発注'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()}`)
  await shot(page, 'r26_C_ltb_dialog')
  await page.keyboard.insertText('長納期のため'); await page.keyboard.press('Enter'); await sleep(300)
  log(`  -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  const r = (await proj(page)).rows.find((x) => x.id === 'R010'); log(`  R010 status=${r.status} flags=${JSON.stringify(r.flags)}`)
  await setRole(page, 'pm'); await sleep(200)
  log(`  PM: view=${await T.view(page)} hints=${(await T.hints(page)).slice(0, 200)} | toast ${await T.toast(page)}`)
  await shot(page, 'r26_C_pm')
})
await step('D 設計: 履歴 → 中を見る → Esc', async () => {
  await fresh(page); await sel(page, 'R005'); await sleep(100)
  const ok = await runPalette(page, '履歴'); await sleep(200)
  log(`  palette ok=${ok} panel: ${await pt()}`)
  await shot(page, 'r26_D_history')
  await page.keyboard.press('Escape'); await sleep(100); log(`  after Esc panel=${await T.panel(page)}`)
})
await step('E 設計: 部品名を打つ → Ctrl+Z → Excel の Ctrl+Y でやり直す', async () => {
  await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
  const before = (await proj(page)).rows.find((x) => x.id === 'R005')
  await typeReal(page, 'Relay', 20); await page.keyboard.press('Enter'); await sleep(150)
  const v = async () => { const r = (await proj(page)).rows.find((x) => x.id === 'R005'); return JSON.stringify({ name: r.name, working: r.working }) }
  log(`  before name=${before.name} | typed: ${await v()}`)
  await page.keyboard.press('Control+z'); await sleep(150); log(`  Ctrl+Z: ${await v()} | ${await T.toast(page)}`)
  await page.keyboard.press('Control+y'); await sleep(150); log(`  Ctrl+Y: ${await v()} | ${await T.toast(page)}`)
})
await step('F PM: 案件設定 → 担当者だけ直して Ctrl+Enter（理由は出るか）', async () => {
  await fresh(page, 'pm'); await sleep(150)
  log('  before ' + (await pinfo()))
  await openSettings()
  await editField('担当者', '田中,佐藤,鈴木')
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  Ctrl+Enter -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  log('  after ' + (await pinfo()))
})
await step('G PM: 案件設定 → 担当者と案件名を直して Ctrl+Enter → 理由「名称変更」→ Enter（両方保存されるか）', async () => {
  await fresh(page, 'pm'); await sleep(150)
  await openSettings()
  await editField('案件名', '第5ライン 搬送制御盤')
  await editField('担当者', '田中,佐藤,鈴木')
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  Ctrl+Enter -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  await page.keyboard.insertText('名称変更'); await page.keyboard.press('Enter'); await sleep(300)
  log(`  理由 Enter -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  log('  after ' + (await pinfo()))
})
await step('H PM: 担当者と案件名を直して Ctrl+Enter → 理由で Esc（何も保存されないか。N16-06）', async () => {
  await fresh(page, 'pm'); await sleep(150)
  log('  before ' + (await pinfo()))
  await openSettings()
  await editField('案件名', '第5ライン 搬送制御盤')
  await editField('担当者', '田中,佐藤,鈴木')
  await page.keyboard.press('Control+Enter'); await sleep(250)
  log(`  Ctrl+Enter -> panel ${await pt()}`)
  await page.keyboard.press('Escape'); await sleep(200)
  log(`  Esc -> toast: ${await T.toast(page)} | panel ${await pt()}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100); log(`  Esc 2 -> toast: ${await T.toast(page)} | panel ${await pt()}`) }
  log('  after ' + (await pinfo()))
})
await step('I 購買 → 設計: 商社を集約（パレット「まとめる」）', async () => {
  for (const role of ['purchasing', 'design']) {
    await fresh(page, role); await sleep(150)
    await clearToast(page)
    await palette(page, 'まとめる'); const top = await page.getByTestId('palette-list').locator('.item').evaluateAll((els) => els.slice(0, 4).map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
    log(`  [${role}] palette まとめる: ${top.join(' | ')}`)
    await page.keyboard.press('Escape')
    const ok = await runPalette(page, '集約', '商社を集約'); await sleep(250)
    log(`  [${role}] ok=${ok} toast: ${await T.toast(page)} | panel ${await pt()}`)
    await shot(page, `r26_I_${role}`)
    if (await T.panel(page)) await page.keyboard.press('Escape')
  }
})
save(errors); await browser.close()
