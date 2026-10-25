// 選択肢・日付・数値の列に新人がそのまま打つ（単位 pcs / set、日付 11/30、必要数 4個、発注数 100pcs、入荷予定 11/5）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, typeReal, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t26_select_date')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const cases = [
  ['design', 1, 'R040', '単位', 'pcs', false], ['design', 1, 'R040', '単位', 'set', false], ['design', 1, 'R040', '単位', 'm', false], ['design', 1, 'R040', '単位', 'PCS', false],
  ['design', 1, 'R040', '必要数', '4個', true], ['design', 1, 'R040', '必要数', '10', true], ['design', 1, 'R040', '入数', '100', true],
  ['design', 1, 'R040', '調達区分', 'shikyu', false],
  ['design', 1, 'R040', '必要日(固定)', '11/30', true], ['design', 1, 'R040', '必要日(固定)', '2026/11/30', true],
  ['purchasing', 3, 'R013', '入荷予定', '11/5', true], ['purchasing', 3, 'R013', '発注数', '100pcs', true], ['purchasing', 3, 'R013', '追加費用', '1,500', true], ['purchasing', 3, 'R013', '費用種別', 'soryo', false],
]
for (const [role, view, id, col, word, needEnter] of cases) {
  try {
    await fresh(page, role); await page.keyboard.press(String(view)); await sel(page, id)
    // 隠れている列は列の表示から出す（新人は c を知らないので、見えない列は Tab で探す）
    const ok = await gotoCol(page, col)
    const r0 = JSON.parse(JSON.stringify((await proj(page)).rows))
    if (needEnter) await page.keyboard.press('Enter')
    if (needEnter) await page.keyboard.press('Control+a')
    await typeReal(page, word, 250); await sleep(200)
    const u = await ui(page); const t = await T.toast(page)
    await page.keyboard.press('Enter'); await sleep(200)
    const u2 = await ui(page); const t2 = await T.toast(page)
    if (u2.mode === 'edit') await page.keyboard.press('Escape')
    const p = await proj(page); const ch = []
    for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); const dd = diff(strip(o), strip(r)); if (dd) ch.push(`${r.id}: ${dd}`) }
    log(`[${role}] ${id} ${col}(${ok}) "${word}"${needEnter ? ' (Enter で編集してから)' : ''}: mid mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${t} | after Enter mode=${u2.mode} err=${t2}`)
    log(`   changes: ${ch.join(' | ') || '(なし)'}`)
  } catch (e) { log('EXC', id, col, word, String(e).slice(0, 200)) }
}
save(errors); await browser.close()
