// N5-02 の流れ（確認 → 隣のセルへ → 値を打つ）を新しい規則で: Alt+x / ID 列の x
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t40_chain')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} sort=${JSON.stringify(u.sort)} | toast: ${await T.toast(page)}`) }
for (const [how, word] of [['F8 Alt+x →', 'relay'], ['F8 Alt+x →', 'AC100V'], ['ID: n x →', 'relay'], ['ID: n x → →', 'relay'], ['ID: x → (ボール) ', 'Sensor']]) {
  log('== ' + how + ' ' + word)
  await fresh(page); await page.keyboard.press('4'); await sleep(150); const r0 = await snap()
  if (how.startsWith('F8')) { await page.keyboard.press('F8'); await sleep(150); await page.keyboard.press('Alt+x'); await sleep(150); await state('Alt+x'); await page.keyboard.press('ArrowRight') }
  else if (how.startsWith('ID: n')) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('n'); await sleep(150); await page.keyboard.press('Home'); await page.keyboard.press('x'); await sleep(150); await state('x on ID'); await page.keyboard.press('ArrowRight'); if (how.endsWith('→ →')) await page.keyboard.press('ArrowRight') }
  else { await page.keyboard.press('F8'); await page.keyboard.press('Home'); await page.keyboard.press('x'); await sleep(150); await state('x on ID'); await page.keyboard.press('ArrowRight') }
  await sleep(100); await state('moved')
  await typeReal(page, word, 80); await sleep(100); await state('typed'); const pt = await T.panelText(page); if (pt) log('   panel', pt.slice(0, 120))
  await page.keyboard.press('Enter'); await sleep(200); await state('Enter'); for (let i = 0; i < 2 && (await T.panel(page)); i++) await page.keyboard.press('Escape')
  log('   changes:', await changes(r0)); await shot(page, `t40_${how.replace(/\W/g, '')}_${word}`)
}
save(errors); await browser.close()
