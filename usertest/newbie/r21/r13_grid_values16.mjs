// ラウンド16: 表で打つ「未定」「〃」の別の書き方 その 4（N13-06 / N14-03 の残り）。カタログの「□」「XX」入りの型式も
import { launch, T, makeLog, sel, gotoCol, sleep, shot } from './lib.mjs'
import { wizardPaste, probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r13_grid_values16')
async function put(id, col, v) { await sel(page, id); await gotoCol(page, col); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(120) }
const id = (n) => 'R' + String(n).padStart(3, '0')
const N = 30
await wizardPaste(page, '品名\t型式\tメーカー\t数量\n' + Array.from({ length: N }, (_, i) => `部品${i + 1}\tMY${i + 1}\tオムロン\t1`).join('\n'))
await page.keyboard.press('Enter'); await sleep(300)
await page.keyboard.press('Control+Enter'); await sleep(250); log('first publish: ' + (await T.toast(page)))
const tbd = ['別途', '追って連絡', '決まり次第', '検討中です', '調整中（来週）', '未 定', '要相談', '問合せ中', '確認待ち', '仮決め', '後で', 'TBD?', '？？', 'MY4N-□□', 'H3CR-A8 AC□V', 'MY4N-XX', 'MY4N-**', 'みてい']
for (let i = 0; i < tbd.length; i++) await put(id(i + 1), '型式', tbd[i])
const dit = ['上と同じ', '上記に同じ', '〃〃', '々', '同', '〃 〃', '"', '””']
for (let i = 0; i < dit.length; i++) await put(id(tbd.length + i + 1), 'メーカ', dit[i])
const pr = await probs(page)
log('problems: ' + pr)
const hit = new Set(pr.split(' | ').map((x) => x.split(':')[0]))
for (let i = 0; i < tbd.length; i++) log(`  型式「${tbd[i]}」 -> ${hit.has(id(i + 1)) ? '警告あり' : '★ 警告なし'}`)
for (let i = 0; i < dit.length; i++) log(`  メーカ「${dit[i]}」 -> ${hit.has(id(tbd.length + i + 1)) ? 'エラー/警告あり' : '★ 何も出ない'}`)
await page.keyboard.press('Control+Enter'); await sleep(250); log('Ctrl+Enter: ' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
if (await T.panel(page)) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); await sleep(250); log('  理由 1 → ' + (await T.toast(page))) }
await shot(page, 'r13_grid_values')
save(errors); await browser.close()
