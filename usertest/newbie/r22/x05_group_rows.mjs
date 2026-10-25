// 分類の見出しの行（g:…）に ↑ で乗ったときに、新人が値を打つ
import { launch, fresh, setRole, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, row, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x05_group_rows')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | cursorbar=${await T.cursor(page)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 200)}`) } ; return out.join(' ; ') || '(なし)' }
const cases = [
  ['design', 1, 'R013', '必要数', '12'], ['design', 1, 'R013', '部品名', 'relay'], ['design', 4, null, '必要数', '3'],
  ['purchasing', 3, 'R013', '追加費用', '5000'], ['purchasing', 9, 'R013', '発注数', '20'], ['purchasing', 1, 'R013', '発注数', '20'],
]
for (const [role, view, id, col, word] of cases) {
  log(`== ${role} view ${view}: ${id ?? '先頭'} ${col} → ↑ → 「${word}」→ Enter`)
  await fresh(page, role); await sleep(150)
  await page.keyboard.press('Alt+' + view); await sleep(100)
  if (id) await sel(page, id); else await page.keyboard.press('ArrowDown')
  await sleep(80); await gotoCol(page, col); await st('at')
  const p0 = await proj(page)
  await page.keyboard.press('ArrowUp'); await sleep(80); await st('↑')
  await shot(page, `x05_${role}_${view}_up`)
  await typeReal(page, word, 30); await sleep(100); await st('typed')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
  log('  CHANGES:', await changes(p0))
}
log('== 見出しの行の見た目（設計 1）')
await fresh(page); await sleep(150); await sel(page, 'R013'); await page.keyboard.press('ArrowUp'); await sleep(100)
const g = await page.evaluate(() => { const a = document.querySelector('[aria-selected="true"], .cursor, .cur'); return a ? a.outerHTML.slice(0, 300) : null }); log('  sel elem', g)
await shot(page, 'x05_group_header_design')
save(errors); await browser.close()
