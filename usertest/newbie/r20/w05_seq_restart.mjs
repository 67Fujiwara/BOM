// 順番に直すモード: 一周の終わり（U11-06）、途中で Esc → もう一度始める、直してから飛ばす
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w05_seq_restart')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] seq=${await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().sequence })} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 90) ?? ''} | toast: ${await T.toast(page)}`) }
const skip = async () => { const txt = (await T.panelText(page)) ?? ''; const m = /(\d) 飛ばして次の問題へ/.exec(txt); if (!m) return false; await page.keyboard.press(m[1]); await sleep(250); return true }
const probs = async () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return document.querySelectorAll('td.err, td.warn, td.problem').length })
log('== A 全部飛ばす（一周で終わるか、飛ばした問題を数える）')
await fresh(page)
// F8 で全問題を数える
const all = []
for (let i = 0; i < 30; i++) { await page.keyboard.press('F8'); await sleep(60); const u = await ui(page); const k = `${u.cursorRow}/${u.cursorCol}`; if (all.includes(k)) break; all.push(k) }
log('  F8 で回った問題', all.length, all.join(' '))
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250)
const seen = []
for (let i = 0; i < 30; i++) { const u = await ui(page); if (!u.panel) break; seen.push(`${u.cursorRow}/${u.cursorCol}`); if (!(await skip())) break }
await st('end')
log('  順番に直すモードで開いた問題', seen.length, seen.join(' '))
log('== B 2 つ飛ばして Esc → もう一度 Ctrl+Shift+F → 1 つ飛ばす')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('start')
await skip(); await st('skip1'); await skip(); await st('skip2')
await page.keyboard.press('Escape'); await sleep(150); await st('Esc')
await page.keyboard.press('Control+Home'); await sleep(80)
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('restart')
await skip(); await st('restart skip1'); await shot(page, 'w05_restart_skip1')
await skip(); await st('restart skip2')
log('== C 別の問題を直しながら（R030 メーカを空にして順番に直す → 1 を選んで直す）')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('start')
const t = (await T.panelText(page)) ?? ''; log('   options: ' + t.slice(0, 300))
await page.keyboard.press('1'); await sleep(300); await st('1')
if ((await ui(page)).mode === 'edit') { await typeReal(page, 'X'); await page.keyboard.press('Enter'); await sleep(300); await st('edit X Enter') }
save(errors); await browser.close()
