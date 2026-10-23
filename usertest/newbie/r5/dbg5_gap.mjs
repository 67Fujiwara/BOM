// 実際のキー間隔（イベントの timeStamp）を測りながら、しきい値付近の速さで打つ
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, diff, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('dbg5_gap')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const cases = [
  ['design', 1, 'R051', '型式', 'snap-1', 300], ['design', 1, 'R051', '型式', 'snap-1', 150],
  ['purchasing', 3, 'R013', 'ロット', 'na', 300], ['purchasing', 3, 'R013', 'ロット', 'na', 150],
  ['design', 1, 'R030', '部品名', 'relay', 350], ['design', 1, 'R030', '部品名', 'relay', 380], ['design', 1, 'R030', '部品名', 'relay', 420], ['design', 1, 'R030', '部品名', 'relay', 500],
  ['purchasing', 3, 'R013', 'ロット', 'ok', 420], ['purchasing', 3, 'R013', 'ロット', 'ok', 500], ['purchasing', 3, 'R013', 'ロット', 'in stock', 500],
  ['design', 1, 'R041', '部品名', 'nut', 500], ['design', 1, 'R041', '部品名', 'knob', 500], ['design', 1, 'R056', '部品名', 'anode', 500],
]
for (const [role, view, id, col, word, d] of cases) {
  await fresh(page, role); await page.keyboard.press(String(view)); await sel(page, id); await gotoCol(page, col)
  await page.evaluate(() => { window.__k = []; if (!window.__kl) { window.__kl = true; window.addEventListener('keydown', (e) => window.__k.push([e.key, Math.round(e.timeStamp)]), true) } })
  const r0 = JSON.parse(JSON.stringify((await proj(page)).rows))
  await typeReal(page, word, d); await page.waitForTimeout(Math.max(50, d)); const u = await ui(page); const t = await T.toast(page); const pt = await T.panelText(page)
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); const pt2 = await T.panelText(page); if (await T.panel(page)) await page.keyboard.press('Escape')
  const ks = await page.evaluate(() => window.__k); const gaps = ks.slice(1).map((k, i) => `${ks[i][0]}→${k[0]}:${k[1] - ks[i][1]}`).join(' ')
  const p = await proj(page); const ch = []
  for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push('NEW ' + r.id); else { const dd = diff(strip(o), strip(r)); if (dd) ch.push(`${r.id}: ${dd}`) } }
  log(`${id} ${col} "${word}" wait=${d}ms gaps[${gaps}]`)
  log(`   mid mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} view=${u.view} toast=${t} panel=${pt?.slice(0, 80)} | afterEnter panel=${pt2?.slice(0, 80)}`)
  log(`   changes: ${ch.join(' | ') || '(なし)'}`)
  if (ch.length !== 1 || !ch[0].startsWith(id)) await shot(page, `dbg5_${id}_${word.replace(/\W/g, '_')}_${d}`)
}
save(errors); await browser.close()
