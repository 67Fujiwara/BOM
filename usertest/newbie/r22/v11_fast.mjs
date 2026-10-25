// ラウンド13: 速く打つ新人（待ちなし）: セルへの打ち込み、Ctrl+Enter 直後の理由・番号、Shift+Enter 直後の打ち込み、Enter 連打
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, proj, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v11_fast')
const fastType = async (s) => { for (const ch of s) await page.keyboard.press(/^[A-Z]$/.test(ch) ? `Shift+Key${ch}` : ch === ' ' ? 'Space' : ch) }
// A: 型式に速く打って ↓ を 5 行
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式')
for (const v of ['MY4N-D2', 'H3CR-A8', '1N4148', 'A22NS-2BL', 'S8VK-G12024']) { await fastType(v); await page.keyboard.press('ArrowDown') }
await sleep(300)
const p = await proj(page); log('A: ' + ['R030', 'R031', 'R032', 'R033', 'R034'].map((id) => `${id}=${JSON.stringify(p.rows.find((r) => r.id === id).working?.model ?? null)}`).join(' '))
// B: 公開を待たずに Ctrl+Enter 1 Tab 2026-012 Enter
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名'); await fastType('Lamp'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await page.keyboard.press('1'); await page.keyboard.press('Tab'); await fastType('2026-012'); await page.keyboard.press('Enter')
await sleep(400)
let q = await proj(page); log('B: sub=' + JSON.stringify(q.submissions.at(-1)?.changeSet) + ' rev=' + q.submissions.at(-1)?.rev + ' toast=' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
log('   R031 working=' + JSON.stringify(q.rows.find((r) => r.id === 'R031').working ?? null) + ' cursor=' + (await T.cursor(page)))
// C: Shift+Enter 直後に打つ（行が出る前に）
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '部品名')
await page.keyboard.press('Shift+Enter'); await fastType('relay'); await page.keyboard.press('Tab'); await fastType('MY4N-D2'); await page.keyboard.press('Tab'); await fastType('omron'); await page.keyboard.press('Tab'); await fastType('4'); await page.keyboard.press('Enter')
await sleep(300)
q = await proj(page); const nr = q.rows.filter((r) => r.status === 'draft' && !['R076', 'R077', 'R078', 'R079', 'R080'].includes(r.id)).map((r) => ({ id: r.id, name: r.name, model: r.model, maker: r.maker, qty: r.qtyNeeded, w: r.working }))
log('C: new rows ' + JSON.stringify(nr) + ' R030=' + JSON.stringify(q.rows.find((r) => r.id === 'R030').working ?? null))
// D: Alt+Shift+A → 2 → 1 → Tab → 3日で入る（速く）
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('Tab'); await fastType('3'); await page.keyboard.insertText('日で入る'); await page.keyboard.press('Enter'); await sleep(300)
const r5 = await row(page, 'R005'); log('D: R005 ' + r5.status + ' ' + r5.adoptedSupplierId + ' ' + JSON.stringify(r5.adoptReason ?? null) + ' toast=' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
// E: Ctrl+Shift+F → すぐ数字
await fresh(page); await page.keyboard.press('Control+Shift+F'); await page.keyboard.press('1'); await sleep(300)
log('E: R005 model=' + JSON.stringify((await row(page, 'R005')).working ?? null) + ' cursor=' + (await T.cursor(page)) + ' panel=' + (await T.panel(page)))
save(errors); await browser.close()
