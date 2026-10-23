// 購買の新人がロット・差分理由など文字の列にいきなり英字を打つ（o=発注、i=入荷 で始まる語）。速い／ゆっくり
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t20_purch_typing')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const cases = [['R013', 'ロット', 'ok', 40], ['R013', 'ロット', 'ok', 300], ['R013', 'ロット', 'order2', 300], ['R013', 'ロット', 'in stock', 300], ['R013', 'ロット', 'in stock', 40], ['R013', 'ロット', 'ink', 300], ['R013', 'ロット', 'OK', 300]]
for (const [id, col, word, d] of cases) {
  await fresh(page, 'purchasing'); await page.keyboard.press('3'); await sel(page, id); const okc = await gotoCol(page, col)
  const r0 = JSON.parse(JSON.stringify((await proj(page)).rows))
  await typeReal(page, word, d); const u = await ui(page); const t = await T.toast(page)
  if (u.panel) await page.keyboard.press('Escape'); else await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const p = await proj(page); const ch = []
  for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); const dd = diff(strip(o), strip(r)); if (dd) ch.push(`${r.id}: ${dd}`) }
  log(`${id} ${col}(${okc}) "${word}" @${d}: mid mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} toast=${t}`)
  log(`   changes: ${ch.join(' | ') || '(なし)'}`)
}
save(errors); await browser.close()
