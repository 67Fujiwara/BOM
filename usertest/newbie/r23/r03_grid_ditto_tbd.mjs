// ラウンド15: 表で打つ「〃」の別の書き方、「未定」の別の書き方、確認済み（欄と値ごと）のあとで値を変えて戻す（N14-03 / N14-05 の直しの確かめ）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, sleep, shot, row, proj } from './lib.mjs'
import { wizardPaste, probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r03_grid_ditto_tbd')
async function put(id, col, v) { await sel(page, id); await gotoCol(page, col); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(120) }
const pv = await wizardPaste(page, '品名\t型式\tメーカー\t数量\n' + Array.from({ length: 14 }, (_, i) => `部品${i + 1}\tMY${i + 1}\tオムロン\t1`).join('\n'))
await page.keyboard.press('Enter'); await sleep(300)
await page.keyboard.press('Control+Enter'); await sleep(250); log('first publish: ' + (await T.toast(page)))
// A: 表で打つ 〃 の書き方
const dit = ['〃', '″', '同　上', '同 上', '＂', '上に同じ', '同上。', '同上']
for (let i = 0; i < dit.length; i++) await put(`R00${i + 1}`.replace(/R00(\d\d)/, 'R0$1'), 'メーカ', dit[i])
log('A ditto: ' + (await probs(page)))
// B: 表で打つ 未定 の書き方（型式）
const tbd = ['未決定', '要検討', '選定中', '仮', '未確定', '保留']
for (let i = 0; i < tbd.length; i++) await put(`R0${String(9 + i).padStart(2, '0')}`, '型式', tbd[i])
log('B tbd: ' + (await probs(page)))
await page.keyboard.press('Control+Enter'); await sleep(250); log('B Ctrl+Enter: ' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
await shot(page, 'r03_B')
// C: 確認済みは欄と値ごと: R001 の型式を 未定 → Alt+x → TBD に → 警告? → 未定に戻す → 警告?
await put('R001', 'メーカ', 'オムロン')
await put('R001', '型式', '未定'); log('C1 未定: ' + JSON.stringify((await row(page, 'R001')).ackRules) + ' ' + (await probs(page)).split(' | ').filter((x) => x.startsWith('R001')).join())
await sel(page, 'R001'); await gotoCol(page, '型式'); await page.keyboard.press('Alt+x'); await sleep(150); log('C2 Alt+x: ' + (await T.toast(page)) + ' ack=' + JSON.stringify((await row(page, 'R001')).ackRules))
await put('R001', 'メーカ', '未定'); log('C3 メーカも未定: ' + (await probs(page)).split(' | ').filter((x) => x.startsWith('R001')).join())
await put('R001', '型式', 'TBD'); log('C4 型式 TBD: ' + (await probs(page)).split(' | ').filter((x) => x.startsWith('R001')).join())
await put('R001', '型式', '未定'); log('C5 型式 未定に戻す: ' + (await probs(page)).split(' | ').filter((x) => x.startsWith('R001')).join() + ' ack=' + JSON.stringify((await row(page, 'R001')).ackRules))
save(errors); await browser.close()
