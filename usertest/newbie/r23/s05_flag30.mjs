// ラウンド23 s05: 【削除？】が 30 行。新人が案内のとおりに片付けられるか。順番に直すモードで 1 を連打／途中で Esc → Shift+Delete（行の取消）→ 再開／Ctrl+Z／最後に公開
import { launch, T, makeLog, ui, sleep, shot, proj, runPalette, palette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's05_flag30')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 12; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 30; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
const flagged = async () => { const p = await proj(page); return p.rows.filter((r) => String(r.note ?? '').startsWith('【削除？】')).length }
const pv = await wizardPaste(page, text); log('preview: ' + pv.slice(0, 600))
await page.keyboard.press('Enter'); await sleep(700)
log('作成 toast: ' + (await T.toast(page))?.slice(0, 300))
log('flagged=' + await flagged() + ' 行数=' + (await proj(page)).rows.length)
await page.keyboard.press('Control+Enter'); await sleep(400)
log('公開 toast: ' + (await T.toast(page))?.slice(0, 260) + ' panel=' + (await T.panelText(page))?.slice(0, 120))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
await page.locator('.gridwrap').focus()
log('view=' + (await ui(page)).view + ' header=' + (await T.header(page)).slice(0, 160))
// A: 新人は Esc → F8 で 1 つずつ。まず Ctrl+. を開いて内容を見る
await page.keyboard.press('F8'); await sleep(200)
await page.keyboard.press('Control+.'); await sleep(250)
log('Ctrl+. の候補: ' + (await T.panelText(page)))
await shot(page, 's05_ctrldot')
await page.keyboard.press('Escape'); await sleep(100)
// B: 順番に直すモード。1 を 10 回
await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(300)
let t0 = Date.now()
for (let i = 0; i < 10; i++) { await page.keyboard.press('1'); await sleep(120) }
log(`1 を 10 回: flagged=${await flagged()} 経過 ${Date.now() - t0}ms panel=${(await ui(page)).panel} cursor=${(await ui(page)).cursorRow} toast=${(await T.toast(page))?.slice(0, 80)}`)
// Ctrl+Z で戻せるか
await page.keyboard.press('Escape'); await sleep(150)
await page.keyboard.press('Control+z'); await sleep(250)
log(`Ctrl+Z 1 回: flagged=${await flagged()} toast=${(await T.toast(page))?.slice(0, 100)}`)
await page.keyboard.press('Control+z'); await sleep(250)
log(`Ctrl+Z 2 回: flagged=${await flagged()}`)
await page.keyboard.press('Control+y'); await sleep(250)
log(`Ctrl+Y: flagged=${await flagged()}`)
// C: 削除したい行は Shift+Delete（案内どおり）。F8 で次の問題へ → Shift+Delete を 5 回
await page.keyboard.press('F8'); await sleep(200)
const cur0 = (await ui(page)).cursorRow
for (let i = 0; i < 5; i++) { await page.keyboard.press('Shift+Delete'); await sleep(250); log(`  Shift+Delete #${i}: cursor=${(await ui(page)).cursorRow} flagged=${await flagged()} toast=${(await T.toast(page))?.slice(0, 80)} panel=${(await ui(page)).panel}`); if ((await ui(page)).panel) { await page.keyboard.press('Escape') } await page.keyboard.press('F8'); await sleep(150) }
// D: モードを始め直して 1 を連打して全部終える
await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(300)
let n = 0
for (let i = 0; i < 40 && (await ui(page)).panel; i++) { await page.keyboard.press('1'); n++; await sleep(100) }
log(`再開して 1 を ${n} 回: flagged=${await flagged()} toast=${(await T.toast(page))?.slice(0, 100)}`)
await page.keyboard.press('Control+Enter'); await sleep(500)
log('公開: ' + (await T.toast(page))?.slice(0, 200) + ' | panel ' + ((await T.panelText(page)) ?? '-').slice(0, 200))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
const p = await proj(page)
log('rows=' + p.rows.length + ' status: ' + [...new Set(p.rows.map((r) => r.status))].join(','))
save(errors); await browser.close()
