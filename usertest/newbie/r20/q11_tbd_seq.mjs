// ラウンド14: 「未定」の警告を順番に直すモード（Ctrl+Shift+F）・Ctrl+. で片付ける（新人は直し方の候補の番号を押す）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q11_tbd_seq')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 260) ?? ''} | toast: ${await T.toast(page)}`) }
await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nヒューズ\t未定\t富士端子\t2\n端子台\tXW2B-20G4\tTBD\t3')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300); await st('created')
await page.keyboard.press('Control+Shift+F'); await sleep(250); await st('Ctrl+Shift+F')
await shot(page, 'q11_tbd_quickfix')
await page.keyboard.press('2'); await sleep(250); await st('2')
await page.keyboard.press('2'); await sleep(250); await st('2 again')
if ((await ui(page)).panel) { await page.keyboard.press('Escape'); await sleep(100) }
await page.keyboard.press('Control+Enter'); await sleep(250); await st('Ctrl+Enter')
const p = await proj(page); log('  rows: ' + p.rows.map((r) => `${r.id}:${r.status}:${r.model}/${r.maker} ack=${JSON.stringify(r.ackRules)} def=${JSON.stringify(r.deferredRules)}`).join(' | '))
save(errors); await browser.close()
