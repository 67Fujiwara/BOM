// ラウンド8: 購買が設計の列（必要数・備考）に数字で始まる値を打つ → 数字でビューが変わり、続く英字が操作になる
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t70_purch_digits_chain')
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d}`) } ; return out.join(' ; ') || '(なし)' }
for (const [view, id, col, word] of [[9, 'R076', '必要数', '12pcs'], [1, 'R013', '備考', '2 in stock'], [1, 'R013', '必要数', '20 hai'], [9, 'R076', '型式', '2SC1815 ok']]) {
  await fresh(page, 'purchasing'); await page.keyboard.press(String(view)); await sleep(100); await sel(page, id); await gotoCol(page, col); const p0 = await proj(page)
  const seq = []
  for (const ch of word) { await page.keyboard.press(ch === ' ' ? 'Space' : ch); await sleep(40); const u = await ui(page); seq.push(`${ch}→v${u.view} ${u.cursorRow}/${u.cursorCol} ${u.mode}${u.panel ? ' panel=' + u.panel : ''}${u.sort ? ' sort' : ''}`) }
  log(`== 購買 view ${view} ${id} ${col} に「${word}」`); log('  ', seq.join(' | ')); log('  toast:', await T.toast(page))
  log('  CHANGES:', await changes(p0))
  await shot(page, `t70_${view}_${col}_${word.replace(/\W/g, '_')}`)
}
save(errors); await browser.close()
