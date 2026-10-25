// 順番に直すモードで指摘の行（R022）に来たとき / 取消・置換・公開・Ctrl+Z・リロード
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, palette, URL } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y05_seq_publish')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 200) ?? ''} | toast: ${await T.toast(page)}`) }

log('== A 順番に直すモード: R016・R009・R041 を直して R022（指摘・提案あり）に来たら')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(150)
for (let i = 0; i < 3; i++) {
  await st('seq ' + i)
  await page.keyboard.press('Enter'); await sleep(60); await page.keyboard.press('Control+a'); await page.keyboard.insertText(i === 0 ? 'CP30-BA 2P 10A' : 'オムロン'); await page.keyboard.press('Enter'); await sleep(200)
}
await st('at R022?')
for (const k of ['Shift+ArrowRight', '2', 'n', 'F8', 'Tab']) { await page.keyboard.press(k); await sleep(100); await st(k) }
await page.keyboard.press('Escape'); await sleep(80); await st('Esc')
log('  表で R022 型式に Shift+→（あとで）')
await sel(page, 'R022'); await gotoCol(page, '型式'); await page.keyboard.press('Shift+ArrowRight'); await sleep(100); await st('Shift+→ on R022')
await shot(page, 'y05_seq_r022')

log('== B 取消（Shift+Delete）→ 公開（理由 1・番号）→ Ctrl+Z → リロード')
await fresh(page); await sel(page, 'R030'); await sleep(50)
await page.keyboard.press('Shift+Delete'); await sleep(100); await st('Shift+Delete')
if ((await ui(page)).panel) { await page.keyboard.press('Enter'); await sleep(100); await st('Enter') }
let r = await row(page, 'R030'); log('  R030', r.status, JSON.stringify(r.pendingRemoval ?? r.removal ?? null))
await page.keyboard.press('Control+Enter'); await sleep(100); await st('Ctrl+Enter')
await page.keyboard.press('1'); await typeReal(page, 'ECN-7'); await page.keyboard.press('Enter'); await sleep(200); await st('1 ECN-7 Enter')
r = await row(page, 'R030'); log('  R030 after publish', r.status, JSON.stringify(r.pendingRemoval ?? r.removal ?? null))
let p = await proj(page); log('  last sub', JSON.stringify(p.submissions.at(-1)).slice(0, 200))
await page.keyboard.press('Control+z'); await sleep(150); await st('Ctrl+Z')
r = await row(page, 'R030'); log('  R030 after undo', r.status, JSON.stringify(r.pendingRemoval ?? r.removal ?? null), JSON.stringify(r.working ?? null))
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await st('reload')
r = await row(page, 'R030'); log('  R030 after reload', r.status, JSON.stringify(r.pendingRemoval ?? r.removal ?? null), JSON.stringify(r.working ?? null))
p = await proj(page); log('  subs', p.submissions.length)

log('== C 置換（パレット「置き換え」）→ 型式を入れて Enter → 公開 → 購買の 5')
await fresh(page); await sel(page, 'R031'); await sleep(50)
await palette(page, '置き換え'); await st('palette'); await page.keyboard.press('Enter'); await sleep(100); await st('Enter')
await typeReal(page, 'M22N-BC-TRA-RC'); await page.keyboard.press('Enter'); await sleep(150); await st('model Enter')
p = await proj(page); const nr = p.rows.at(-1); log('  new row', nr.id, nr.name, nr.model, nr.qtyNeeded, nr.status, ' R031 removal', JSON.stringify((await row(page, 'R031')).removal ?? null))
await page.keyboard.press('Control+Enter'); await sleep(100); await st('Ctrl+Enter')
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await sleep(50); await page.keyboard.press('Enter'); await sleep(200); await st('↓↓↓ Enter')
log('  R031', (await row(page, 'R031')).status, ' new', (await row(page, nr.id)).status)
await page.getByTestId('role-purchasing').click(); await page.locator('.gridwrap').focus(); await page.keyboard.press('Alt+5'); await sleep(150); await st('purch 5')
log('  5 rows: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')).join(','))))

log('== D Ctrl+Z / Ctrl+Y 連打（10 回）→ リロード')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '必要数')
for (const v of ['3', '4', '5']) { await typeReal(page, v); await page.keyboard.press('Enter'); await sleep(50) }
for (let i = 0; i < 10; i++) await page.keyboard.press('Control+z'); await sleep(100); await st('Ctrl+Z x10')
for (let i = 0; i < 10; i++) await page.keyboard.press('Control+y'); await sleep(100); await st('Ctrl+Y x10')
log('  R030-32 qty', JSON.stringify([(await row(page, 'R030')).working, (await row(page, 'R031')).working, (await row(page, 'R032')).working]))
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300)
log('  after reload', JSON.stringify([(await row(page, 'R030')).working, (await row(page, 'R031')).working, (await row(page, 'R032')).working]))
save(errors); await browser.close()
