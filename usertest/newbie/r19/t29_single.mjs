// 1 文字の値（分類 A / B、回路記号 R、ロット A）を打って Enter
import { launch, fresh, T, makeLog, sel, gotoCol, proj, ui, typeReal, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t29_single')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
for (const [role, view, id, col, word] of [['design', 1, 'R043', '分類', 'A'], ['design', 1, 'R043', '分類', 'B'], ['design', 1, 'R044', '回路記号', 'R'], ['design', 1, 'R044', '回路記号', 'S'], ['purchasing', 3, 'R013', 'ロット', 'A'], ['purchasing', 3, 'R013', 'ロット', 'i']]) {
  await fresh(page, role); await page.keyboard.press(String(view)); await sel(page, id); await gotoCol(page, col)
  const r0 = JSON.parse(JSON.stringify((await proj(page)).rows))
  await typeReal(page, word, 0); await sleep(120); await page.keyboard.press('Enter'); await sleep(300)
  const pt = await T.panelText(page); const t = await T.toast(page); if (pt) { await page.keyboard.press('Enter'); await sleep(250) }
  const t2 = await T.toast(page); if (await T.panel(page)) await page.keyboard.press('Escape')
  const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push('NEW ' + r.id); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } }
  log(`[${role}] ${id} ${col} "${word}" Enter: panel=${pt?.slice(0, 100)} toast=${t} | (Enter again) toast=${t2}`)
  log(`   changes: ${ch.join(' | ') || '(なし)'}`)
}
save(errors); await browser.close()
