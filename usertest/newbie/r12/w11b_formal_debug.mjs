// PM 承認 ON で置換 → 公開 → 却下 のあと、置換先 R081 が購買の流れに残るか（正式見積の対象・発注）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w11b_formal_debug')
const st = (id) => row(page, id).then((r) => r ? `${r.id}:${r.status}${r.removal ? ' removal=' + JSON.stringify(r.removal) : ''}${r.pendingRemoval ? ' pendingRemoval' : ''}${r.replaces ? ' replaces=' + r.replaces : ''} ordered=${r.ordered} adopted=${r.adoptedSupplierId} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}` : `${id}: (なし)`)
await fresh(page)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'pm'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
for (let i = 0; i < 20; i++) { const s = await page.locator('.overlay [aria-selected="true"]').innerText().catch(() => ''); if (/承認が必要/.test(s)) break; await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('はい'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.insertText('テスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'design'); await page.keyboard.press('1')
// 相見積の選定済の行 R001 を置換
log('R001 before', await st('R001'))
await sel(page, 'R001'); await page.keyboard.press('Alt+r'); await page.getByTestId('prompt-text').fill('FX5U-32MR/ES-NEW'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
const nid = (await proj(page)).rows.find((r) => r.replaces === 'R001')?.id
await sel(page, nid); await gotoCol(page, '回路記号'); await page.keyboard.press('Alt+x'); await page.waitForTimeout(50)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
log('published:', await T.toast(page), '|', await st('R001'), '|', await st(nid))
await setRole(page, 'pm'); await sel(page, 'R001'); await page.keyboard.press('Shift+Y'); await page.waitForTimeout(80); await page.keyboard.insertText('却下テスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
log('rejected:', await T.toast(page), '|', await st('R001'), '|', await st(nid))
log('header', (await T.header(page)).replace(/\s+/g, ' ').slice(0, 200))
await setRole(page, 'purchasing')
await runPalette(page, '正式見積を依頼'); log('formal confirm', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('2'); await page.waitForTimeout(200)
const cnt = async () => { const p = await proj(page); const m = {}; for (const r of p.rows) m[r.status] = (m[r.status] ?? 0) + 1; return JSON.stringify(m) + ' sel=' + p.rows.filter((r) => r.status === 'selected').map((r) => r.id + (r.working ? '●' : '') + (r.flags?.pmPending ? 'P' : '')).join(',') }
log('before', await cnt(), 'view', (await ui(page)).view, 'mode', (await ui(page)).mode, 'panel', (await ui(page)).panel)
await page.keyboard.press('2'); await page.waitForTimeout(100)
const toasts = []; for (let i = 0; i < 10; i++) { toasts.push(await T.toast(page)); await page.waitForTimeout(100) }
log('toasts', [...new Set(toasts)].join(' || '))
log('after', await cnt(), 'panel', await T.panelText(page), 'ui', JSON.stringify(await ui(page)))
await shot(page, 'w11b_after_formal')
save(errors); await browser.close()
