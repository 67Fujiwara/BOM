// 新人の Excel の癖: 打って ↓ / ↑ / ← / →（入力モード）、Enter・F2 で始めた編集の中の矢印（編集モード）
import { launch, fresh, setRole, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, finding, save } = makeLog('y01_arrows')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 220)}`) } ; for (const q of p1.quotes) { const q0 = p0.quotes.find((x) => x.rowId === q.rowId && x.supplierId === q.supplierId && !x.stale); const d = diff(q0 ?? {}, q); if (d && !q.stale) out.push(`Q ${q.rowId}@${q.supplierId}: ${d.slice(0, 200)}`) } return out.join(' ; ') || '(なし)' }

async function scen(title, role, setup, keys) {
  log('== ' + title)
  await fresh(page, role)
  await setup()
  await st('start')
  const p0 = await proj(page)
  for (const k of keys) {
    if (k.t) await typeReal(page, k.t, 25)
    else if (k.ins) await page.keyboard.insertText(k.ins)
    else await page.keyboard.press(k)
    await sleep(60)
    await st(k.t ?? k.ins ?? k)
  }
  log('  CHANGES: ' + (await changes(p0)))
}
const at = (id, col, view) => async () => { if (view) { await page.keyboard.press('Alt+' + view); await sleep(80) } await sel(page, id); await sleep(50); await gotoCol(page, col) }

// 1. 選択の列（単位）で打って ↓
await scen('設計: 単位で m ↓ 本 ↓ 個 Enter（R030〜R032）', 'design', at('R030', '単位'), [{ t: 'm' }, 'ArrowDown', { ins: '本' }, 'ArrowDown', { ins: '個' }, 'Enter'])
await scen('設計: 単位で pcs ↓ m ↓（候補に無い語）', 'design', at('R030', '単位'), [{ t: 'pcs' }, 'ArrowDown', { t: 'm' }, 'ArrowDown'])
await scen('設計: 調達区分で sh ↓ so ↓', 'design', at('R030', '調達区分'), [{ t: 'sh' }, 'ArrowDown', { t: 'so' }, 'ArrowDown'])
await scen('設計: 代替可否で ka ↓ fuka ↓', 'design', at('R030', '代替可否'), [{ t: 'ka' }, 'ArrowDown', { t: 'fuka' }, 'ArrowDown'])
// 2. 打って ↑
await scen('設計: 必要数 R032 で 7 ↑ 8 ↑ 9 Enter', 'design', at('R032', '必要数'), [{ t: '7' }, 'ArrowUp', { t: '8' }, 'ArrowUp', { t: '9' }, 'Enter'])
// 3. 打って ← で打ち間違いを直すつもり
await scen('設計: 型式で MY4X ← Backspace N（打ち間違いを直すつもり）', 'design', at('R030', '型式'), [{ t: 'MY4X' }, 'ArrowLeft', 'Backspace', { t: 'N' }, 'Enter'])
// 4. Enter で始めた編集の中の矢印
await scen('設計: 型式 Enter → ← ← → Home End（文字の中を動く）→ X Enter', 'design', at('R030', '型式'), ['Enter', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'Home', 'End', { t: 'X' }, 'ArrowDown', 'Enter'])
await scen('設計: F2 → 必要数を打ち直す 5 → ↓（Enter で始めた編集）', 'design', at('R030', '必要数'), ['F2', { t: '5' }, 'ArrowDown', 'Enter'])
// 5. 見出しの行をまたぐ ↓
await scen('設計: R012（電源の直前）必要数 3 ↓ 4 ↓', 'design', at('R012', '必要数'), [{ t: '3' }, 'ArrowDown', { t: '4' }, 'ArrowDown'])
await scen('設計: R013 必要数 5 ↑（上は見出し）', 'design', at('R013', '必要数'), [{ t: '5' }, 'ArrowUp', { t: '6' }, 'Enter'])
// 6. 読めない値で ↓
await scen('設計: 必要数 1O（オー）↓ → 続けて 3 ↓', 'design', at('R030', '必要数'), [{ t: '1O' }, 'ArrowDown', { t: '3' }, 'ArrowDown', 'Escape'])
// 7. 日付の列
await scen('設計: 必要日(固定) 11/5 ↓ 12/1 ↓', 'design', at('R030', '必要日(固定)'), [{ t: '11/5' }, 'ArrowDown', { t: '12/1' }, 'ArrowDown'])
// 8. 一番下の行で打って ↓
await scen('設計: 最後の行で 7 ↓ 8 ↓', 'design', async () => { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Control+ArrowDown'); await gotoCol(page, '必要数') }, [{ t: '7' }, 'ArrowDown', { t: '8' }, 'ArrowDown', 'Escape'])
// 9. 購買 6: 横に → で打つ（単価 → 納期 → MOQ）、↓ で次の行
await scen('購買 6: R033 単価 120 → 14 → 10 ↓', 'purchasing', at('R033', '単価', 6), [{ t: '120' }, 'ArrowRight', { t: '14' }, 'ArrowRight', { t: '10' }, 'ArrowDown'])
await scen('購買 6: R033 単価 120 Tab 14 Tab 10 Enter（Tab の流れ）', 'purchasing', at('R033', '単価', 6), [{ t: '120' }, 'Tab', { t: '14' }, 'Tab', { t: '10' }, 'Enter'])
// 10. 購買 6: 自動で始まった入力の中で ← → （空のまま）
await scen('購買 6: 単価 120 Enter → 自動で始まった空の入力で → → ← ', 'purchasing', at('R033', '単価', 6), [{ t: '120' }, 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowLeft', { t: '9' }, 'Enter'])
// 11. 設計 4 要確認で直して ↓（行がビューから外れる）
await scen('設計 4: 先頭の問題（F8）を直して ↓', 'design', async () => { await page.keyboard.press('Alt+4'); await sleep(80); await page.keyboard.press('F8'); await sleep(50) }, [{ t: 'ABC-1 10A' }, 'ArrowDown', { t: 'X' }, 'Escape'])
// 12. 3 発注・入荷 で 入荷予定 11/5 ↓ 11/6 ↓
await scen('購買 3: 入荷予定 R013 11/5 ↓ 11/6 ↓', 'purchasing', at('R013', '入荷予定', 3), [{ t: '11/5' }, 'ArrowDown', { t: '11/6' }, 'ArrowDown'])
await shot(page, 'y01_end')
save(errors); await browser.close()
