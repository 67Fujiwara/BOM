// N11-02 再検証の続き: いまの値が候補の先頭でないセルで Enter / F2 → ↓ / ↑ → Enter。強調と入る値
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w02_select_current')
const cands = async () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return (m.useStore.getState().editCandidates ?? []).join(' ') })
const hl = async () => { const c = page.getByTestId('candidates'); if (!(await c.count())) return '-'; return c.locator('[aria-selected="true"]').first().textContent() }
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} 強調=${await hl()} cands=[${await cands()}] | toast: ${await T.toast(page)}`) }
const w = async (id) => JSON.stringify((await row(page, id))?.working ?? null)
async function scen(title, id, col, pre, keys, shotName) {
  log('== ' + title)
  await fresh(page); await sel(page, id); if (!(await gotoCol(page, col))) log('  !! col not found ' + col)
  if (pre) { await typeReal(page, pre); await page.keyboard.press('Enter'); await sleep(80); await page.keyboard.press('ArrowUp'); await sleep(60); log(`  pre ${pre} -> ${await w(id)}`) }
  for (const k of keys) { if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else await page.keyboard.press(k); await sleep(60); await st(k); if (shotName && k === keys[0]) await shot(page, shotName) }
  log(`  ${id}: ${await w(id)}`)
}
await scen('単位を「m」にしてから Enter → ↓ → Enter（m の次の「セット」のつもり）', 'R030', '単位', 'm', ['Enter', 'ArrowDown', 'Enter'], 'w02_unit_m_enter')
await scen('単位を「m」にしてから Enter → Enter（強調は「個」）', 'R030', '単位', 'm', ['Enter', 'Enter'])
await scen('単位を「m」にしてから Enter → ↑ → Enter（m の上の「本」のつもり）', 'R030', '単位', 'm', ['Enter', 'ArrowUp', 'Enter'])
await scen('調達区分を「指定商社」にしてから Enter → ↓ → Enter（支給品のつもり）', 'R030', '調達区分', 'sh', ['Enter', 'ArrowDown', 'Enter'])
await scen('代替可否（同等品可）で Enter → ↓ → Enter（不可のつもり）', 'R030', '代替可否', null, ['Enter', 'ArrowDown', 'Enter'], 'w02_alt_enter')
await scen('代替可否（同等品可）で F2 → ↓ → ↓ → Enter', 'R030', '代替可否', null, ['F2', 'ArrowDown', 'ArrowDown', 'Enter'])
await scen('代替可否を「不可」にしてから Enter → ↓ → Enter（客先承認要のつもり）', 'R030', '代替可否', 'fuka', ['Enter', 'ArrowDown', 'Enter'])
await scen('単位 Enter → ↓ → Esc（やめる）', 'R030', '単位', null, ['Enter', 'ArrowDown', 'Escape'])
// 購買 6 の在庫
log('== 購買 6: 在庫の列 Enter → ↓ → Enter')
await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(150); await sel(page, 'R005'); await sleep(80)
const cur0 = await T.cursor(page); log('  cursor', cur0)
for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (/在庫/.test(c)) break; await page.keyboard.press('ArrowRight') }
log('  cursor', await T.cursor(page))
for (const k of ['Enter', 'ArrowDown', 'Enter']) { await page.keyboard.press(k); await sleep(80); await st(k) }
const p = await proj(page); log('  R005 quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === 'R005').map((q) => [q.supplierId, q.stock])))
save(errors); await browser.close()
