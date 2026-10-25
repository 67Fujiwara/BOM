// 購買の新人: 6 で見積をいろいろな書き方で打つ / 3 で発注・入荷の列に値を打つ / 8 で正式単価
import { launch, fresh, setRole, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x08_purch_values')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 200)}`) } ; for (const q of p1.quotes) { const q0 = p0.quotes.find((x) => x.rowId === q.rowId && x.supplierId === q.supplierId && !x.stale); const d = diff(q0 ?? {}, q); if (d && !q.stale) out.push(`Q ${q.rowId}@${q.supplierId}: ${d.slice(0, 200)}`) } return out.join(' ; ') || '(なし)' }
const vals = { 単価: ['1,200円', '¥1,200', '１２００', '1.2k', '1200-', 'TBD', '0', '-5'], 納期: ['2週間', '即納', '2W', '10日', '3営業日', '１０'], MOQ: ['10個', '1箱'], 在庫: ['あり', 'zaiko', '有', '在庫有'], 有効期限: ['12/31', '2026/12/31', '令和8年12月31日', '来月末', '2025/1/1'] }
await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(150)
let rid = 33
for (const [col, list] of Object.entries(vals)) {
  for (const v of list) {
    const id = 'R0' + rid
    await sel(page, id); await sleep(50); const ok = await gotoCol(page, col)
    const p0 = await proj(page)
    if (/^[\x20-\x7e]+$/.test(v)) await typeReal(page, v, 20); else { await typeReal(page, v[0].match(/[\x20-\x7e]/) ? v[0] : '', 20); await page.keyboard.insertText(v[0].match(/[\x20-\x7e]/) ? v.slice(1) : v) }
    await page.keyboard.press('Enter'); await sleep(100)
    const u = await ui(page)
    log(`  ${col}(${ok}) ${id} 「${v}」 -> mode=${u.mode} toast=${await T.toast(page)} | ${await changes(p0)}`)
    if (u.mode === 'edit') await page.keyboard.press('Escape')
  }
  rid++
}
log('== 購買 3: 発注・入荷の列に値を打つ（入荷日のつもり・済・ok）')
for (const [col, id, v] of [['入荷', 'R013', '11/5'], ['入荷', 'R013', 'zumi'], ['発注', 'R001', 'ok'], ['発注', 'R004', '20'], ['入荷予定', 'R013', '11/5'], ['ロット', 'R013', 'LOT-A1']]) {
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+3'); await sleep(100); await sel(page, id); const ok = await gotoCol(page, col)
  const p0 = await proj(page)
  await typeReal(page, v, 40); await page.keyboard.press('Enter'); await sleep(150)
  const u = await ui(page)
  log(`  ${col}(${ok}) ${id} 「${v}」 -> mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} toast=${await T.toast(page)} | ${await changes(p0)}`)
  await shot(page, `x08_3_${col}_${v.replace(/\W/g, '_')}`)
}
save(errors); await browser.close()
