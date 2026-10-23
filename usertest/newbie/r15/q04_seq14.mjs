// ラウンド14: 順番に直すモードのやり直し（N13-01 の修正）: 途中の行から始める・直してから Esc・F8 を混ぜる・マウスで別の行
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q04_seq14')
const seqv = () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().sequence })
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] seq=${await seqv()} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 70) ?? ''} | toast: ${await T.toast(page)}`) }
const skip = async () => { const txt = (await T.panelText(page)) ?? ''; const m = /(\d) 飛ばして次の問題へ/.exec(txt); if (!m) return false; await page.keyboard.press(m[1]); await sleep(250); return true }
async function runAll(tag) { const seen = []; for (let i = 0; i < 20; i++) { const u = await ui(page); if (!u.panel) break; seen.push(u.cursorRow); if (!(await skip())) break } await st(tag + ' end'); log(`  ${tag}: 開いた問題 ${seen.length} 件 ${seen.join(' ')}`) }

const probs = () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/commands/registry.ts')); const m = await import(u); return m.problemCells().map((x) => x.rowId + '/' + x.field).join(' ') })

log('== F 2 つ飛ばして Esc（カーソルは 3 つ目の問題の上）→ そのまま Ctrl+Shift+F')
await fresh(page); log('  problems: ' + (await probs()))
await page.keyboard.press('Control+Shift+F'); await sleep(250); await skip(); await skip(); await st('skip2')
await page.keyboard.press('Escape'); await sleep(150); await st('Esc')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await runAll('F restart')

log('== G 表の真ん中（R030、問題なし）から Ctrl+Shift+F')
await fresh(page); await sel(page, 'R030'); await sleep(80)
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('start@R030')
await runAll('G')

log('== H 最初の問題を直し方 1 で直す → Esc → Ctrl+Shift+F')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('start')
await page.keyboard.press('1'); await sleep(300); await st('fix 1')
if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await sleep(100); await st('Esc edit') }
await page.keyboard.press('Escape'); await sleep(150); await st('Esc')
log('  problems: ' + (await probs()))
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await runAll('H restart')

log('== I 1 つ飛ばす → F8（新人は F8 も押す）→ F8 → Ctrl+Shift+F')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await skip(); await st('skip1')
await page.keyboard.press('F8'); await sleep(200); await st('F8')
await page.keyboard.press('F8'); await sleep(200); await st('F8 2')
await page.keyboard.press('Escape'); await sleep(100)
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await runAll('I restart')
save(errors); await browser.close()
