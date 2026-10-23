// PM 承認 ON で設計の変更セット → PM が 7 の部品名で Shift+Y（却下のつもり）→ 案内「例: Alt+y」→ Alt+y
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t52_pm_shift_y')
const panels = async (keys, tag) => { for (const k of keys) { const pt = await T.panelText(page); if (!pt) break; log(`  [${tag}] panel: ${pt.slice(0, 160)}`); await page.keyboard.press(k); await sleep(120) } log(`  [${tag}] toast: ${await T.toast(page)}`) }
await fresh(page)
await page.keyboard.press('Control+Enter'); await sleep(100); await panels(['2', 'Enter'], 'pub0')
await setRole(page, 'pm'); await runPalette(page, '案件設定'); await sleep(100)
for (let i = 0; i < 20; i++) { const s = await page.locator('.overlay [aria-selected="true"]').innerText().catch(() => ''); if (/承認が必要/.test(s)) break; await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('はい'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100)
await page.keyboard.insertText('テスト'); await page.keyboard.press('Enter'); await sleep(100)
log('approval', (await proj(page)).settings.changeNeedsPmApproval)
await setRole(page, 'design'); await page.keyboard.press('1')
await sel(page, 'R033'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M2BJ-B24D-NEW'); await page.keyboard.press('Enter')
await sel(page, 'R016'); await gotoCol(page, '型式'); await page.keyboard.press('Alt+KeyX'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(100); await panels(['2', 'Enter', 'Enter', 'Enter'], 'pub')
const r0 = await row(page, 'R033'); log('R033 before PM', r0.status, r0.model, JSON.stringify(r0.pending ?? null))
await setRole(page, 'pm'); await sleep(150)
log('PM 7 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(',')))
await sel(page, 'R033'); await gotoCol(page, '部品名'); log('cursor', await T.cursor(page), '| hints', await T.hints(page))
await page.keyboard.press('Shift+KeyY'); await sleep(150); log('Shift+Y ->', await T.toast(page), '| panel', await T.panelText(page))
await page.keyboard.press('Alt+KeyY'); await sleep(200); log('Alt+y ->', await T.toast(page), '| panel', await T.panelText(page))
await shot(page, 't52_alt_y')
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(150); log('Enter ->', await T.toast(page), '| panel', await T.panelText(page)) }
const r1 = await row(page, 'R033'); log('R033 after', r1.status, r1.model, JSON.stringify(r1.pending ?? null)); const p = await proj(page); log('decisions', JSON.stringify((p.decisions ?? []).slice(-3)).slice(0, 600))
save(errors); await browser.close()
