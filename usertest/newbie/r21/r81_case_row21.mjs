// ラウンド21: PM の 7 の「案件設定確定」の行で数字キー（ビュー切替）と y。新人は 7 のまま 1〜9 を押し、戻って y を押す。
// A 数字 1〜9 を順に（ビューが替わるか・値が入らないか）→ 7 に戻って y → B 確定後の数字 → C 行の選択がある別ビューで y
import { launch, T, makeLog, ui, sleep, shot, proj, setRole, clearToast } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r81_case_row21')
const st = async (tag) => { const u = await ui(page); const p = await proj(page); log(`  [${tag}] role=${u.role} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} panel=${u.panel} editValue=${JSON.stringify(u.editValue)} | pmConfirmed=${p.settings.pmConfirmed} | toast=${((await T.toast(page)) ?? '').slice(0, 120)}`) }
await wizardPaste(page, '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2')
await page.keyboard.press('Enter'); await sleep(350)
await page.keyboard.press('Control+Enter'); await sleep(350)
if (await T.panel(page)) await page.keyboard.press('Escape')
await setRole(page, 'pm'); await sleep(250)
log('== A: 案件設定確定の行（未確定）で数字')
await st('start')
for (const d of ['3', '7', '1', '7', '9', '7', '2', '7', '5', '7', '0', '7', '8', '7']) {
  await page.keyboard.press(d); await sleep(180); await st('digit ' + d); await clearToast(page)
}
log('  hints: ' + (await T.hints(page)).slice(0, 200))
log('== A2: 列を右へ動かして数字（case 行の列）')
await page.keyboard.press('ArrowRight'); await sleep(100); await st('→')
await page.keyboard.press('4'); await sleep(150); await st('4'); await page.keyboard.press('7'); await sleep(150); await st('7')
log('== A3: 文字を打つ（Excel 風に 5 を打ってから Enter）')
await page.keyboard.press('Home'); await page.keyboard.insertText('12'); await sleep(150); await st('insertText 12')
await page.keyboard.press('Escape'); await sleep(100); await st('Esc')
log('== A4: Shift+数字・Ctrl+数字・Alt+数字')
for (const k of ['Shift+Digit1', 'Control+Digit1', 'Alt+Digit2', 'Control+Digit7']) { await page.keyboard.press(k); await sleep(150); await st(k); await clearToast(page) }
log('== B: y で確定')
await page.keyboard.press('7').catch(() => {}); await sleep(100)
await page.keyboard.press('ArrowDown'); await sleep(150); await st('↓ (戻ったあと)')
await page.keyboard.press('y'); await sleep(300); await st('y')
await clearToast(page)
log('  hints: ' + (await T.hints(page)).slice(0, 200))
log('== C: 確定後の数字')
for (const d of ['1', '2', '7']) { await page.keyboard.press(d); await sleep(150); await st('digit ' + d); await clearToast(page) }
await shot(page, 'r81_end')
save(errors); await browser.close()
