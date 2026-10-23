// Shift+A / Shift+I / c / w で始まる語の残りの文字がダイアログに入ったとき、何が起きるか
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t02_panelwords')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0 })
const cases = [['R049', '型式', 'AC100V'], ['R056', '型式', 'A1'], ['R049', 'メーカ', 'ABB'], ['R058', '型式', 'A2-1'], ['R040', '部品名', 'IO unit'], ['R040', '部品名', 'IQ sensor'], ['R042', 'メーカ', 'IDEC'], ['R035', '部品名', 'cable 2m'], ['R036', '部品名', 'w1'], ['R037', '部品名', 'cord 3'], ['R036', '部品名', 'washer M4']]
for (const [id, col, word] of cases) {
  for (const after of ['Enter', 'Escape']) {
    try {
      await fresh(page); await page.keyboard.press('1'); await sel(page, id); await gotoCol(page, col)
      const p0 = await proj(page); const r0 = JSON.parse(JSON.stringify(p0.rows)); const i0 = p0.issues.length; const cols0 = (await ui(page)).hiddenCols.length
      await typeReal(page, word, 40)
      const mid = await T.panelText(page); const tm = await T.toast(page)
      await page.keyboard.press(after); await page.waitForTimeout(120)
      const mid2 = await T.panelText(page); const tm2 = await T.toast(page)
      if (await T.panel(page)) { await page.keyboard.press('Escape'); await page.waitForTimeout(60) }
      const p1 = await proj(page); const u = await ui(page)
      const ch = []; for (const r of p1.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push('NEW ' + r.id); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } }
      log(`${id} ${col} "${word}" then ${after}: panelMid=${mid?.slice(0, 140)} | toast=${tm}`)
      log(`   after ${after}: panel=${mid2?.slice(0, 120)} toast=${tm2}`)
      log(`   changes: ${ch.join(' | ') || '(なし)'} | issues ${i0}->${p1.issues.length} ${p1.issues.slice(i0).map((x) => `${x.rowId}/${x.kind}/${x.status}/"${x.body}"`).join(',')} | hiddenCols ${cols0}->${u.hiddenCols.length} weights=${JSON.stringify(p1.rows.find((r) => r.id === id).weights ?? null)}`)
      if (after === 'Enter') await shot(page, `t02_${id}_${word.replace(/\W/g, '_')}`)
    } catch (e) { log('EXC', word, String(e).slice(0, 200)) }
  }
}
save(errors); await browser.close()
