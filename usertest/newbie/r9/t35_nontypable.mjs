// 文字を打てないセル（他の役割の列・ボール・状態・ID）で値のつもりで打つ新人、数字で始まる値
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t35_nontypable')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => { const p = await proj(page); return { rows: JSON.parse(JSON.stringify(p.rows)), issues: p.issues.length } }
const changes = async (s0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = s0.rows.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } if (p.issues.length !== s0.issues) ch.push(`issues ${s0.issues}->${p.issues.length}`); return ch.join(' | ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} sort=${JSON.stringify(u.sort)} | toast: ${await T.toast(page)}`) }
const tryType = async (role, view, id, colLabel, word, after = 'Enter') => {
  await fresh(page, role); await page.keyboard.press(String(view)); await sleep(100); await sel(page, id); const ok = await gotoCol(page, colLabel)
  const s0 = await snap(); await state(`${role} ${id} ${colLabel}(${ok})`)
  await typeReal(page, word, 60); await sleep(100); await state(`typed "${word}"`); const pt = await T.panelText(page); if (pt) log('   panel:', pt.slice(0, 160))
  if (after) { await page.keyboard.press(after); await sleep(150); await state(after) }
  for (let i = 0; i < 2 && (await T.panel(page)); i++) { await page.keyboard.press('Escape'); await sleep(80) }
  log('   changes:', await changes(s0))
  await shot(page, `t35_${role}_${id}_${word.replace(/\W/g, '_')}`)
}
await step('購買: 備考（設計の列）に ok', () => tryType('purchasing', 1, 'R013', '備考', 'ok'))
await step('購買: 部品名（設計の列）に in stock', () => tryType('purchasing', 1, 'R013', '部品名', 'in stock'))
await step('購買: 型式（設計の列）に hold', () => tryType('purchasing', 1, 'R040', '型式', 'hold'))
await step('設計: 状態の列に ok', () => tryType('design', 1, 'R030', '状態', 'ok'))
await step('設計: ボールの列に hold', () => tryType('design', 1, 'R031', 'ボール', 'hold'))
await step('設計: ロット（購買の列）に ok', () => tryType('design', 1, 'R013', 'ロット', 'ok'))
await step('設計: 単価（自動計算）に sale', () => tryType('design', 1, 'R033', '単価', 'sale'))
await step('PM: 7 で部品名に ok', () => tryType('pm', 7, 'R003', '部品名', 'ok'))
await step('設計: 型式に 1N4148', () => tryType('design', 1, 'R035', '型式', '1N4148'))
await step('設計: 型式に 2SC1815', () => tryType('design', 1, 'R036', '型式', '2SC1815'))
await step('設計: メーカに 3M', () => tryType('design', 1, 'R037', 'メーカ', '3M'))
await step('設計: 回路記号に 1K1（番号付き）', () => tryType('design', 1, 'R038', '必要数', '12'))
await step('U3-06: 1 つずつ入力でボールの列から Sensor', async () => {
  await fresh(page)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(60); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill('NEW-U'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(200)
  await state('created'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await state('Home →')
  const s0 = await snap()
  await typeReal(page, 'Sensor', 80); await state('Sensor'); await page.keyboard.press('Tab'); await typeReal(page, 'E2E-X5ME1', 80); await page.keyboard.press('Tab'); await typeReal(page, 'Omron', 80); await page.keyboard.press('Enter'); await sleep(150)
  await state('done'); log('   changes:', await changes(s0)); await shot(page, 't35_U306')
})
await step('ID 列で n n n（新人が「ID 列なら英字が効く」と覚えた）', async () => {
  await fresh(page); await page.keyboard.press('4'); await sleep(100); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await state('ID')
  const s0 = await snap()
  for (let i = 0; i < 3; i++) { await page.keyboard.press('n'); await sleep(120); await state('n#' + i) }
  await page.keyboard.press('Enter'); await sleep(120); await state('Enter'); log('   changes:', await changes(s0))
})
save(errors); await browser.close()
