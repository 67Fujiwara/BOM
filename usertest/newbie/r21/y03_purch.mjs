// 購買の新人: 8 を開いてすぐ正式単価を打つ / 9 で数字 / 6 の見積を日本語で（Enter で編集を始めてから）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y03_purch')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 220)}`) } ; for (const q of p1.quotes) { const q0 = p0.quotes.find((x) => x.rowId === q.rowId && x.supplierId === q.supplierId && !x.stale); const d = diff(q0 ?? {}, q); if (d && !q.stale) out.push(`Q ${q.rowId}@${q.supplierId}: ${d.slice(0, 200)}`) } return out.join(' ; ') || '(なし)' }

log('== 購買: Alt+8 → すぐ正式単価のつもりで 1500 Enter 1480 Enter')
await fresh(page, 'purchasing'); let p0 = await proj(page)
await page.keyboard.press('Alt+8'); await sleep(100); await st('Alt+8')
const hdr = await page.locator('thead th').allInnerTexts(); log('  cols: ' + hdr.join('|').replace(/\s+/g, ' '))
await typeReal(page, '1500'); await st('1500'); await page.keyboard.press('Enter'); await sleep(100); await st('Enter')
await typeReal(page, '1480'); await page.keyboard.press('Enter'); await sleep(100); await st('1480 Enter')
log('  CHANGES: ' + (await changes(p0)))
await shot(page, 'y03_8_orderqty')
log('== 購買: サイドの 8 をクリック → 1500 Enter')
await fresh(page, 'purchasing'); p0 = await proj(page)
await page.getByTestId('view-8').click(); await sleep(100); await page.locator('.gridwrap').focus(); await st('click 8')
await typeReal(page, '1500'); await page.keyboard.press('Enter'); await sleep(100); await st('1500 Enter')
log('  CHANGES: ' + (await changes(p0)))

log('== 購買 9: ビューを変えるつもりで 8 → 6 → Enter')
await fresh(page, 'purchasing'); p0 = await proj(page); await st('start')
await page.keyboard.press('8'); await page.keyboard.press('6'); await st('86'); await page.keyboard.press('Enter'); await sleep(100); await st('Enter')
log('  CHANGES: ' + (await changes(p0)))

log('== 購買 6: Enter で編集を始めて日本語の値（IME 確定のつもり）')
const vals = [['単価', ['１２００', '¥1,200', '1,200円', '１，２００円', '1200円（税別）']], ['納期', ['即納', '2W', '3営業日', '１０日', '約2週間', '2～3週間', '受注後3週']], ['在庫', ['あり', '有', '在庫有', '在庫あり', 'なし', '無']], ['有効期限', ['令和8年12月31日', 'R8.12.31', '2026年12月31日', '12月末', '来月末']], ['MOQ', ['１０', '10個', '1リール', '100pcs']]]
await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(100)
let rid = 33
for (const [col, list] of vals) {
  for (const v of list) {
    const id = 'R0' + rid
    await sel(page, id); await sleep(40); await gotoCol(page, col)
    const pp = await proj(page)
    await page.keyboard.press('Enter'); await sleep(40); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(100)
    const u = await ui(page)
    log(`  ${col} ${id}「${v}」 -> mode=${u.mode} toast=${await T.toast(page)} | ${await changes(pp)}`)
    if (u.mode === 'edit') { await page.keyboard.press('Escape'); await sleep(40) }
    if (u.mode === 'edit' && (await ui(page)).mode === 'edit') await page.keyboard.press('Escape')
  }
  rid++
}
save(errors); await browser.close()
