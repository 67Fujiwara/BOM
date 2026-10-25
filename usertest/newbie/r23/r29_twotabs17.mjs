// ラウンド17: 新人がアプリを 2 つのタブで開いたまま作業する（ブックマークを 2 回クリック）。V16-09 の直し（公開を戻す Ctrl+Z が別のタブの作業中の値を上書きしない）を新人の操作で。
// タブ A: R030 の部品名を直して公開 → タブ B: 同じ R030 の備考を打つ（作業中）→ タブ A: 「やっぱり」Ctrl+Z → もう一度 Ctrl+Z → タブ B を見る
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, attachErrors, URL } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r29_twotabs17')
const st = async (pg, tag) => { const r = await row(pg, 'R030'); const r2 = await row(pg, 'R031'); log(`  [${tag}] R030 name=${r.name} note=${JSON.stringify(r.note)} pub=${r.publishedRev} working=${JSON.stringify(r.working ?? null)} | R031 working=${JSON.stringify(r2.working ?? null)} | toast: ${(await T.toast(pg))?.slice(0, 200)}`) }
async function typeCell(pg, id, col, val) { await sel(pg, id); await gotoCol(pg, col); await typeReal(pg, val, 15); await pg.keyboard.press('Enter'); await sleep(150) }
log('== タブ A を開く（データを消して）→ タブ B を開く（同じブラウザ）')
await fresh(page)
const pageB = await context.newPage(); attachErrors(pageB, errors, 'B')
await pageB.goto(URL); await pageB.getByTestId('grid').waitFor(); await pageB.locator('.gridwrap').focus(); await sleep(300)
await st(page, 'A start'); await st(pageB, 'B start')
log('== A: R031 の部品名を直す（作業中）→ R030 の部品名を Lamp に直して Ctrl+Enter → 理由 1 → Enter')
await page.bringToFront(); await page.locator('.gridwrap').focus()
await typeCell(page, 'R031', '部品名', 'Fuse')
await typeCell(page, 'R030', '部品名', 'Lamp')
await page.keyboard.press('Control+Enter'); await sleep(200); log('  A panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 140))
if (await T.panel(page)) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); await sleep(300) }
await st(page, 'A published')
log('== B: タブを切り替えて R030 の備考に「納期確認中」と打つ（作業中）')
await pageB.bringToFront(); await pageB.locator('.gridwrap').focus(); await sleep(400)
await st(pageB, 'B before')
await typeCell(pageB, 'R030', '備考', 'nouki')
await st(pageB, 'B typed')
log('== A: タブを戻して「やっぱり公開をやめる」Ctrl+Z → Ctrl+Z → Ctrl+Z')
await page.bringToFront(); await page.locator('.gridwrap').focus(); await sleep(500)
await st(page, 'A back')
for (const k of ['Control+z', 'Control+z', 'Control+z']) { await page.keyboard.press(k); await sleep(250); await st(page, 'A ' + k) }
await shot(page, 'r29_A_after_undo')
log('== B: 戻って見る')
await pageB.bringToFront(); await pageB.locator('.gridwrap').focus(); await sleep(500)
await st(pageB, 'B after')
await shot(pageB, 'r29_B_after')
save(errors); await browser.close()
