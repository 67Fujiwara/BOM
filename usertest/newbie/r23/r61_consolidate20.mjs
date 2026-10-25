// ラウンド20: 商社を集約の確認（U19-04 の直し）を新人の押し方で。1 やめる／2 集約する／Enter 連打／数字 2 → Ctrl+Z → もう一度 Ctrl+Z
import { launch, fresh, T, makeLog, ui, sleep, proj, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r61_consolidate20')
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 320)} | toast=${(await T.toast(page))?.slice(0, 200)}`) }
const cnt = async () => { const p = await proj(page); return `adopted=${p.rows.filter((r) => r.adoptedSupplierId).length} selected=${p.rows.filter((r) => r.status === 'selected').length}` }
await fresh(page); await sleep(150)
log('before ' + await cnt())
await runPalette(page, '商社を集約'); await sleep(250); await U('集約 一覧')
await page.keyboard.press('Enter'); await sleep(250); await U('Enter（1 番目）')
await page.keyboard.press('Enter'); await sleep(250); await U('Enter 連打（確認の既定）'); log(await cnt())
await runPalette(page, '商社を集約'); await sleep(250); await page.keyboard.press('Enter'); await sleep(250)
await page.keyboard.press('2'); await sleep(150); await U('2 を押した'); 
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(300); await U('Enter') }
log('after 集約 ' + await cnt())
await page.keyboard.press('Control+z'); await sleep(300); await U('Ctrl+Z'); log('after undo ' + await cnt())
await page.keyboard.press('Control+z'); await sleep(300); await U('Ctrl+Z 2'); log('after undo2 ' + await cnt())
await page.keyboard.press('Control+y'); await sleep(300); await U('Ctrl+Y'); log('after redo ' + await cnt())
save(errors); await browser.close()
