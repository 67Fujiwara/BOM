// ラウンド16: 名前を入れずに作った BOM（新しいBOM P-…）の名前を新人が直す。設計のまま → 権限なし → PM で 案件設定 → 案件名 → Enter → 打つ → Enter → 閉じる（Esc）/ Ctrl+Enter。
// ついでに PM 項目に Excel の書き方で打つ（予算 280万円・重み 40:30:20:10・担当者を空白区切り・納期 11月末）
import { launch, T, makeLog, ui, sleep, shot, proj, palette, setRole, store } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r16_settings16')
const st = async (tag) => { const u = await ui(page); const p = await proj(page); const inp = page.getByTestId('settings-input'); log(`  [${tag}] project=${p.id}「${p.name}」 budget=${p.settings.budget} weights=${JSON.stringify(p.weights)} members=${JSON.stringify(p.members)} due=${p.dueDate} panel=${u.panel} 欄=${(await inp.count()) ? JSON.stringify(await inp.inputValue()) : '-'} | toast: ${(await T.toast(page))?.slice(0, 200)}`) }
async function openSettings() { await palette(page, '案件設定'); await page.keyboard.press('Enter'); await sleep(200) }
async function editField(label, val) {
  const items = await page.getByTestId('settings').locator('.opt').allTextContents()
  const i = items.findIndex((t) => t.includes(label))
  const cur = await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().panel.index })
  for (let k = cur; k < i; k++) await page.keyboard.press('ArrowDown')
  for (let k = cur; k > i; k--) await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('Control+a'); await page.keyboard.insertText(val); await page.keyboard.press('Enter'); await sleep(150)
  await st(`${label} ← ${val}`)
}
await wizardPaste(page, '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4')
await page.keyboard.press('Enter'); await sleep(350); await st('created')
log('== A 設計のまま 案件設定 → 案件名 で Enter')
await openSettings(); log('  panel: ' + (await T.panelText(page))?.slice(0, 200))
await page.keyboard.press('Enter'); await sleep(150); await st('Enter on 案件名')
await page.keyboard.press('Escape'); await sleep(100)
log('== B PM に切り替えて 案件名 を直す → Esc で閉じる（Ctrl+Enter を知らない）')
await setRole(page, 'pm'); await sleep(150)
await openSettings()
await editField('案件名', '第4ライン 搬送制御盤')
await page.keyboard.press('Escape'); await sleep(150); await st('Esc 1')
await page.keyboard.press('Escape'); await sleep(150); await st('Esc 2')
log('== C もう一度: 案件名 → Enter → Ctrl+Enter')
await openSettings()
await editField('案件名', '第4ライン 搬送制御盤')
await page.keyboard.press('Control+Enter'); await sleep(250); await st('Ctrl+Enter'); log('  panel: ' + (await T.panelText(page))?.slice(0, 200))
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(250); await st('Enter（理由を空のまま）') }
if ((await ui(page)).panel === 'prompt') { await page.keyboard.insertText('名前を付けた'); await page.keyboard.press('Enter'); await sleep(250); await st('理由を打って Enter') }
log('== C2 担当者と案件名を直して Ctrl+Enter → 理由のダイアログで Esc（やめる）')
await openSettings()
await editField('案件名', '第5ライン')
await editField('担当者', '山田,佐藤,鈴木')
await page.keyboard.press('Control+Enter'); await sleep(250); await st('Ctrl+Enter'); log('  panel: ' + (await T.panelText(page))?.slice(0, 120))
await page.keyboard.press('Escape'); await sleep(200); await st('Esc（理由をやめる）')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150); await st('Esc 2') }
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150); await st('Esc 3') }
log('== D PM 項目に Excel の書き方で')
await openSettings()
for (const [l, v] of [['予算', '280万円'], ['予算', '2,800,000円'], ['重み', '40:30:20:10'], ['重み', '４０，３０，２０，１０'], ['担当者', '山田 佐藤 鈴木'], ['担当者', '山田、佐藤、鈴木'], ['案件納期', '11月末'], ['案件納期', 'R8.11.30'], ['案件納期', '2026年11月30日']]) {
  await editField(l, v)
  if ((await ui(page)).panel === 'settings' && (await page.getByTestId('settings-input').count())) { await page.keyboard.press('Escape'); await sleep(100); await st('Esc（編集を抜ける）') }
}
await shot(page, 'r16_settings_D')
await page.keyboard.press('Control+Enter'); await sleep(250); await st('Ctrl+Enter'); log('  panel: ' + (await T.panelText(page))?.slice(0, 300))
for (let i = 0; i < 3 && (await T.panel(page)); i++) { if ((await ui(page)).panel === 'prompt') await page.keyboard.insertText('客先の指示'); await page.keyboard.press('Enter'); await sleep(250); await st('Enter ' + i); log('  panel: ' + (await T.panelText(page))?.slice(0, 200)) }
await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150)
log('  inbox: ' + (await page.getByTestId('inbox').innerText()).split('\n').filter(Boolean).join(' / ').slice(0, 500))
save(errors); await browser.close()
