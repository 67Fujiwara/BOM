// 新しい BOM を作った直後の Ctrl+Z 連打、公開 → Ctrl+Z → リロード、取消 → Ctrl+Z
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, store, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w12_undo_wizard')
const summary = async () => { const ws = await store(page); const p = ws.projects.find((x) => x.id === ws.currentProjectId); return `projects=${ws.projects.map((x) => x.id).join(',')} cur=${ws.currentProjectId} rows=${p?.rows.length} subs=${p?.submissions.length} first=${JSON.stringify(p?.rows[0] ? { n: p.rows[0].name, w: p.rows[0].working, s: p.rows[0].status } : null)}` }
await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
log('  created', await summary(), '| toast', await T.toast(page))
await sel(page, 'R001'); await gotoCol(page, '必要数'); await typeReal(page, '8'); await page.keyboard.press('Enter'); await sleep(100)
log('  after edit', await summary())
for (let i = 1; i <= 4; i++) { await page.keyboard.press('Control+z'); await sleep(150); log(`  Ctrl+Z #${i}: ${await T.toast(page)} | ${await summary()}`) }
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); log('  reload', await summary())
log('== 公開 → Ctrl+Z → リロード')
await sel(page, 'R002'); await gotoCol(page, '必要数'); await typeReal(page, '3'); await page.keyboard.press('Enter'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(250); log('  publish', await T.toast(page), '| panel', await T.panelText(page))
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200) }
log('  after publish', await summary())
await page.keyboard.press('Control+z'); await sleep(200); log('  Ctrl+Z', await T.toast(page), await summary())
await page.keyboard.press('Control+z'); await sleep(200); log('  Ctrl+Z 2', await T.toast(page), await summary())
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); log('  reload', await summary())
await page.keyboard.press('Control+y'); await sleep(200); log('  Ctrl+Y after reload', await T.toast(page), await summary())
save(errors); await browser.close()
