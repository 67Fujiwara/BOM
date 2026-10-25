// ラウンド14: 公開のあとの Ctrl+Z（V13-10 の修正）を新人の操作で: 公開してすぐ「やっぱり」→ Ctrl+Z → もう一度 Ctrl+Z → Ctrl+Y、リロード、購買から見る
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q05_publish_undo')
const st = async (tag) => { const u = await ui(page); const r = await row(page, 'R030'); const p = await proj(page); log(`  [${tag}] mode=${u.mode} panel=${u.panel} R030 ${r.status} name=${r.name} pub=${r.publishedRev} working=${JSON.stringify(r.working ?? null)} subs=${p.submissions.map((s) => s.rev).join(',')} | toast: ${await T.toast(page)}`) }
async function pubR030(val) {
  await sel(page, 'R030'); await gotoCol(page, '部品名'); await typeReal(page, val, 15); await page.keyboard.press('Enter'); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(150); await page.keyboard.press('1'); await page.keyboard.press('Enter'); await sleep(250)
}
log('== A 直す → 公開 → Ctrl+Z → Ctrl+Z → Ctrl+Z → Ctrl+Y → Ctrl+Y')
await fresh(page); await st('start')
await pubR030('Lamp')
await st('published')
for (const k of ['Control+z', 'Control+z', 'Control+z', 'Control+y', 'Control+y']) { await page.keyboard.press(k); await sleep(200); await st(k) }
await shot(page, 'q05_A')

log('== B 公開 → Ctrl+Z（公開を戻す）→ そのままリロード → 購買で見る')
await fresh(page); await pubR030('Lamp2'); await st('published')
await page.keyboard.press('Control+z'); await sleep(200); await st('Ctrl+Z')
await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus(); await sleep(300); await st('reload')
await setRole(page, 'purchasing'); await sleep(150)
log('  purch R030: ' + (await T.rowText(page, 'R030')))

log('== C 公開 → Ctrl+Z → 直し直して Ctrl+Enter（もう一度公開）')
await fresh(page); await pubR030('Lamp3'); await st('published')
await page.keyboard.press('Control+z'); await sleep(200); await st('Ctrl+Z')
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter'); log('   panel: ' + (await T.panelText(page))?.slice(0, 160))
if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(250); await st('2 Enter') }

log('== D 公開 → 別の行を直す → Ctrl+Z → Ctrl+Z → Ctrl+Z（戻しすぎ）')
await fresh(page); await pubR030('Lamp4'); await st('published')
await sel(page, 'R031'); await gotoCol(page, '部品名'); await typeReal(page, 'Fuse', 15); await page.keyboard.press('Enter'); await sleep(100)
for (const k of ['Control+z', 'Control+z', 'Control+z']) { await page.keyboard.press(k); await sleep(200); await st(k); log('     R031 ' + JSON.stringify((await row(page, 'R031')).working ?? null) + ' name=' + (await row(page, 'R031')).name) }
save(errors); await browser.close()
