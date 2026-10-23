// ラウンド13: 順番に直すモードを途中で Esc → もう一度始める（新人は迷うとすぐ Esc）。F8 との混在、Ctrl+.
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v03_seq13')
const seqv = () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().sequence })
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] seq=${await seqv()} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 70) ?? ''} | toast: ${await T.toast(page)}`) }
const skip = async () => { const txt = (await T.panelText(page)) ?? ''; const m = /(\d) 飛ばして次の問題へ/.exec(txt); if (!m) return false; await page.keyboard.press(m[1]); await sleep(250); return true }
async function runAll(tag) { const seen = []; for (let i = 0; i < 20; i++) { const u = await ui(page); if (!u.panel) break; seen.push(u.cursorRow); if (!(await skip())) break } await st(tag + ' end'); log(`  ${tag}: 開いた問題 ${seen.length} 件 ${seen.join(' ')}`) }

log('== A 1 つ飛ばして Esc → Ctrl+Shift+F でやり直し → 全部飛ばす')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('start')
await skip(); await st('skip1')
await page.keyboard.press('Escape'); await sleep(150); await st('Esc')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await runAll('A restart')
await shot(page, 'v03_A_restart_end')

log('== B 3 つ飛ばして Esc → 表で ↓ 少し動く → Ctrl+Shift+F → 全部飛ばす')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250)
await skip(); await skip(); await skip(); await st('skip3')
await page.keyboard.press('Escape'); await sleep(150)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await sleep(80); await st('moved')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await runAll('B restart')

log('== C 全部飛ばして一周 → もう一度 Ctrl+Shift+F（二回目も全部見られるか）')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await runAll('C1')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await runAll('C2')

log('== D Esc → リロード → Ctrl+Shift+F')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await skip(); await skip(); await page.keyboard.press('Escape'); await sleep(100)
await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus(); await sleep(200)
await page.keyboard.press('Control+Home'); await page.keyboard.press('Control+Shift+F'); await sleep(250); await runAll('D after reload')

log('== E 2 つ飛ばして、パネルの外の表をクリック（マウス）→ Ctrl+Shift+F')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await skip(); await skip(); await st('skip2')
await page.locator('[data-row-id="R003"] td').nth(3).click().catch((e) => log('click err ' + e)); await sleep(150); await st('clicked R003')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await runAll('E restart')
save(errors); await browser.close()
