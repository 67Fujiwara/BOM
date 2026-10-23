// PM 承認 ON で置換 → 公開 → 却下 のあと、置換先 R081 が購買の流れに残るか（正式見積の対象・発注）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t16_reject_replace')
const st = (id) => row(page, id).then((r) => r ? `${r.id}:${r.status}${r.removal ? ' removal=' + JSON.stringify(r.removal) : ''}${r.pendingRemoval ? ' pendingRemoval' : ''}${r.replaces ? ' replaces=' + r.replaces : ''} ordered=${r.ordered} adopted=${r.adoptedSupplierId} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}` : `${id}: (なし)`)
await fresh(page)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'pm'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
for (let i = 0; i < 20; i++) { const s = await page.locator('.overlay [aria-selected="true"]').innerText().catch(() => ''); if (/承認が必要/.test(s)) break; await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('はい'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.insertText('テスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'design'); await page.keyboard.press('1')
// 相見積の選定済の行 R001 を置換
log('R001 before', await st('R001'))
await sel(page, 'R001'); await page.keyboard.press('r'); await page.getByTestId('prompt-text').fill('FX5U-32MR/ES-NEW'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
const nid = (await proj(page)).rows.find((r) => r.replaces === 'R001')?.id
await sel(page, nid); await gotoCol(page, '回路記号'); await page.keyboard.press('x'); await page.waitForTimeout(50)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
log('published:', await T.toast(page), '|', await st('R001'), '|', await st(nid))
await setRole(page, 'pm'); await sel(page, 'R001'); await page.keyboard.press('Shift+Y'); await page.waitForTimeout(80); await page.keyboard.insertText('却下テスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
log('rejected:', await T.toast(page), '|', await st('R001'), '|', await st(nid))
log('header', (await T.header(page)).replace(/\s+/g, ' ').slice(0, 200))
await setRole(page, 'purchasing')
await runPalette(page, '正式見積を依頼'); log('formal confirm', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('2'); await page.waitForTimeout(200)
for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('  panel', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Enter'); await page.waitForTimeout(250) }
log('after formal:', await T.toast(page), '|', await st('R001'), '|', await st(nid))
await page.keyboard.press('1'); await sel(page, nid); log('purchasing sees new row', (await page.locator(`[data-row-id="${nid}"]`).innerText()).replace(/\s+/g, ' '))
await page.keyboard.press('3'); await sel(page, nid); await page.keyboard.press('o'); await page.waitForTimeout(100); log('o (order) on new row ->', await T.toast(page), '|', await st(nid))
await shot(page, 't16_reject_replace')
save(errors); await browser.close()
