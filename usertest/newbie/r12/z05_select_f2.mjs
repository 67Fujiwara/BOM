// 選択の列: Enter で始めて ↓ で候補を選ぶ / 打って F2 → ↓ / 打って → ← Tab / 9 のメーカ指定
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z05_select_f2')
const cands = async () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return (m.useStore.getState().editCandidates ?? []).join(' ') })
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} lbl=${await T.mode(page)} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} cands=[${await cands()}] | toast: ${await T.toast(page)}`) }
const w = async (id) => JSON.stringify((await row(page, id))?.working ?? null)
async function scen(title, id, col, keys) {
  log('== ' + title)
  await fresh(page); await sel(page, id); if (!(await gotoCol(page, col))) log('  !! col not found ' + col)
  for (const k of keys) { if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else await page.keyboard.press(k); await sleep(60); await st(k) }
  log(`  ${id}: ${await w(id)} | next: ${await w('R0' + (Number(id.slice(1)) + 1))}`)
}
await scen('単位: Enter → ↓ → ↓ → Enter（候補を選ぶ）', 'R030', '単位', ['Enter', 'ArrowDown', 'ArrowDown', 'Enter'])
await shot(page, 'z05_unit_enter_down')
await scen('単位: Enter → ↓ → Enter', 'R030', '単位', ['Enter', 'ArrowDown', 'Enter'])
await scen('調達区分: Enter → ↓ ↓ → Enter', 'R030', '調達区分', ['Enter', 'ArrowDown', 'ArrowDown', 'Enter'])
await scen('単位: s を打つ → F2 → ↓ → Enter（候補を回してから確定）', 'R030', '単位', ['t:s', 'F2', 'ArrowDown', 'Enter'])
await scen('単位: pcs → →（右へ確定）→ sh → ↓', 'R030', '単位', ['t:pcs', 'ArrowRight', 't:sh', 'ArrowDown'])
await scen('調達区分: zaiko → ←', 'R030', '調達区分', ['t:zaiko', 'ArrowLeft'])
await scen('調達区分: sh → Tab', 'R030', '調達区分', ['t:sh', 'Tab'])
await scen('代替可否: F2（打たずに）→ ↓ → Enter', 'R030', '代替可否', ['F2', 'ArrowDown', 'Enter'])
await scen('代替可否: Delete → ↓（空にしてから）', 'R030', '代替可否', ['Delete', 'ArrowDown'])
await scen('単位: Backspace（空にする）→ Enter', 'R030', '単位', ['Backspace', 'Enter'])
save(errors); await browser.close()
