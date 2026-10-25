// 設計の新人: いろいろな値の打ち方（数字・記号で始まる型式、Excel の癖 = + ' 、数量・日付の書き方）、行を足して打つ、Enter 連打
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w07_design_values')
const vals = {
  型式: ['3M-1181', '1N4148', '<5mm', '#10-24', '=SUM(A1)', '+24V', "'0123", '1/4W 10kΩ', '-', 'teikou'],
  部品名: ['teikou', '10kΩ抵抗', '?', '/仮', '[A]端子'],
  必要数: ['2個', '２', '1,000', '1e3', '-1', '0.5', '1/2', '=2*3', '10m', '三'],
  必要日: ['11/5', '2026/11/5', '11月5日', 'R8.11.5', '来週', '2026-02-30', '1105'],
  メーカ: ['omron', 'OMRON', 'オムロン㈱', '3M', '-'],
}
await fresh(page)
let rid = 40
for (const [col, list] of Object.entries(vals)) {
  for (const v of list) {
    const id = 'R0' + rid
    await sel(page, id); await sleep(40); const ok = await gotoCol(page, col)
    const before = JSON.stringify((await row(page, id)).working ?? null)
    if (/^[\x20-\x7e]+$/.test(v)) await typeReal(page, v, 15); else { const a = v.match(/^[\x20-\x7e]+/)?.[0] ?? ''; if (a) await typeReal(page, a, 15); await page.keyboard.insertText(v.slice(a.length)) }
    const u0 = await ui(page)
    await page.keyboard.press('Enter'); await sleep(100)
    const u = await ui(page)
    const r = await row(page, id)
    log(`  ${col}(${ok}) ${id} 「${v}」 typed-edit=${JSON.stringify(u0.editValue)} mode0=${u0.mode} -> mode=${u.mode} cur=${u.cursorRow} err=${(await page.getByTestId('edit-error').count()) ? await page.getByTestId('edit-error').textContent() : ''} toast=${await T.toast(page)} | working=${JSON.stringify(r.working ?? null)} (before ${before})`)
    if (u.mode === 'edit') await page.keyboard.press('Escape')
    rid++
    if (rid > 75) rid = 40
  }
}
await shot(page, 'w07_after_values')
log('== 最後の行で Enter を 5 回（行が増える？）')
await fresh(page); await page.keyboard.press('Control+End'); await sleep(80); log('  cursor', await T.cursor(page))
const n0 = (await proj(page)).rows.length
for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(80); log(`   Enter ${i + 1}: mode=${(await ui(page)).mode} cur=${await T.cursor(page)} toast=${await T.toast(page)}`) }
log('  rows', n0, '->', (await proj(page)).rows.length)
log('== Shift+Enter で行を足して、部品名→Tab→型式→Tab→…と打つ')
await fresh(page); await sel(page, 'R030'); await page.keyboard.press('Shift+Enter'); await sleep(150); log('  after Shift+Enter', await T.cursor(page), await T.toast(page))
for (const v of ['relay', 'MY4N-D2', 'omron', '4']) { await typeReal(page, v, 15); await page.keyboard.press('Tab'); await sleep(60); log(`   typed ${v} -> cur=${await T.cursor(page)} toast=${await T.toast(page)}`) }
const p = await proj(page); const nr = p.rows.find((r) => r.status === 'draft' && !['R076', 'R077', 'R078', 'R079', 'R080'].includes(r.id) && (r.name === 'relay' || r.working?.name === 'relay'))
log('  new row', JSON.stringify(nr ? { id: nr.id, name: nr.name, model: nr.model, maker: nr.maker, qty: nr.qtyNeeded, working: nr.working } : null))
await shot(page, 'w07_new_row')
save(errors); await browser.close()
