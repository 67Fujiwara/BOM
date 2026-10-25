// Excel の癖: 打って ↓（Enter の代わり）→ 次の値を打つ。打って → で右へ
import { launch, fresh, setRole, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x07_arrows_edit')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 200)}`) } ; return out.join(' ; ') || '(なし)' }
log('== 設計: R030 必要数 に 12 ↓ 3 ↓ 5 Enter（3 行に入れるつもり）')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '必要数')
let p0 = await proj(page)
await typeReal(page, '12', 30); await page.keyboard.press('ArrowDown'); await sleep(50); await st('12 ↓')
await typeReal(page, '3', 30); await page.keyboard.press('ArrowDown'); await sleep(50); await st('3 ↓')
await typeReal(page, '5', 30); await page.keyboard.press('Enter'); await sleep(100); await st('5 Enter')
log('  CHANGES:', await changes(p0)); await shot(page, 'x07_down_qty')
log('== 設計: R030 型式 に MY4N → で右（メーカ）へ → OMRON Enter')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式')
p0 = await proj(page)
await typeReal(page, 'MY4N', 30); await page.keyboard.press('ArrowRight'); await sleep(50); await st('MY4N →')
await typeReal(page, 'OMRON', 30); await page.keyboard.press('Enter'); await sleep(100); await st('OMRON Enter')
log('  CHANGES:', await changes(p0))
log('== 購買 6: 単価 に 120 ↓ 130 ↓ Enter')
await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(100); await sel(page, 'R033'); await gotoCol(page, '単価'); await st('at price')
p0 = await proj(page)
await typeReal(page, '120', 30); await page.keyboard.press('ArrowDown'); await sleep(50); await st('120 ↓')
await typeReal(page, '130', 30); await page.keyboard.press('ArrowDown'); await sleep(50); await st('130 ↓')
await page.keyboard.press('Enter'); await sleep(100); await st('Enter')
const ws = await proj(page); log('  R033/R034 S1 price', JSON.stringify(ws.quotes.filter((q) => ['R033', 'R034', 'R035'].includes(q.rowId) && q.supplierId === 'S1').map((q) => [q.rowId, q.unitPrice])))
save(errors); await browser.close()
