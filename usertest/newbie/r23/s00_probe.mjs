import { launch, T, makeLog, ui, sleep, shot, proj, palette, runPalette } from './lib.mjs'
import { wizardPaste, probs, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('s00_probe')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 4; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
for (let i = 1; i <= 3; i++) rows.push(`予定${i}\tQ-${i}0\t\tオムロン\t1\t削除予定`)
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
const pv = await wizardPaste(page, text); log('preview: ' + pv.slice(0, 900))
await page.keyboard.press('Enter'); await sleep(500)
log('toast ' + await T.toast(page))
const p = await proj(page); log(rowsText(p))
await page.keyboard.press('Control+Enter'); await sleep(400); log('publish: ' + await T.toast(page) + ' | ' + ((await T.panelText(page)) ?? '').slice(0, 300))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
await page.locator('.gridwrap').focus()
const ok = await runPalette(page, '順番に直す', '順番に直すモード'); log('palette ' + ok); await sleep(400)
log('panel: ' + ((await T.panelText(page)) ?? ''))
await shot(page, 's00_seq')
log('status ' + await T.status(page) + ' hints ' + await T.hints(page))
save(errors); await browser.close()
