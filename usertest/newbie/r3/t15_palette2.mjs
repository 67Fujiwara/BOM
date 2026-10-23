// パレットで新人の言葉 → Enter の結果（直す / 読み込み / 選定者 / 新規 / 提出）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, paletteTop, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t15_palette2')
// 直す: 編集 → Ctrl+Z → パレット「直す」Enter
await fresh(page); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('WRONG'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+z'); log('after Ctrl+Z R040 working', JSON.stringify((await row(page, 'R040')).working))
await sel(page, 'R009'); await palette(page, '直す'); log('palette 直す top', (await paletteTop(page, 3)).join(' || ')); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
log('  Enter ->', await T.toast(page), '| panel', await T.panelText(page), '| R040 working', JSON.stringify((await row(page, 'R040')).working))
await shot(page, 't15_naosu_enter'); if (await T.panel(page)) await page.keyboard.press('Escape')
// 読み込み
await palette(page, '読み込み'); log('palette 読み込み top', (await paletteTop(page, 2)).join(' || ')); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.toast(page), '| panel', await T.panelText(page)); if (await T.panel(page)) await page.keyboard.press('Escape')
// 選定者（PM）
await setRole(page, 'pm'); const a0 = (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length
await palette(page, '選定者'); log('PM palette 選定者 top', (await paletteTop(page, 2)).join(' || ')); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.toast(page), '| panel', await T.panelText(page), '| adopted', a0, '->', (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length); if (await T.panel(page)) await page.keyboard.press('Escape')
// 設計で「選定者」→ 一括採用が走るか
await setRole(page, 'design'); const b0 = (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length
await palette(page, '選定者'); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('design 選定者 Enter ->', await T.toast(page), '| panel', await T.panelText(page), '| adopted', b0, '->', (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length)
if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter again ->', await T.toast(page), '| panel', await T.panelText(page), '| adopted ->', (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length) }
await shot(page, 't15_senteisha'); if (await T.panel(page)) await page.keyboard.press('Escape')
// 新規 / 提出
await palette(page, '新規'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('新規 Enter ->', await T.toast(page), '| panel', await T.panel(page)); if (await T.panel(page)) await page.keyboard.press('Escape')
await palette(page, '提出'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('提出 Enter ->', await T.toast(page), '| view', (await ui(page)).view, '| panel', await T.panel(page))
save(errors)
await browser.close()
