// Playwright の実打鍵（keyboard.press＋待ち）で、ページ内打鍵と同じ結果になるかを確かめる＋ r（置換）の後の型式（V3-02）
import { launch, fresh, setRole, goto, toCol, mode, sleep, dumpErrors, save, row, proj, closeAll, toastNow, panel, cursor } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = { real: [], r: [] }
async function typeReal(text, gap) { for (const ch of text) { await page.keyboard.press(/^[A-Z]$/.test(ch) ? 'Shift+' + ch : ch); await sleep(gap) } }
const CASES = [['メーカ', 'Analog'], ['メーカ', 'Knowles'], ['型式', 'sn74hc595'], ['備考', 'i2c'], ['部品名', 'Inductor'], ['部品名', 'coil'], ['型式', 'ADP3338'], ['回路記号', 'K1'], ['部品名', 'knob']]
for (const [col, text] of CASES) for (const gap of [80, 250]) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toCol(page, col)
  const p0 = JSON.stringify((await proj(page)).rows)
  const c0 = await cursor(page)
  await typeReal(text, gap); await sleep(600)
  const m = await mode(page)
  const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue() : null
  const c1 = await cursor(page); const pn = await panel(page)
  await page.keyboard.press('Enter'); await sleep(200)
  const p1 = (await proj(page)).rows
  const before = JSON.parse(p0)
  const changed = p1.filter((r) => JSON.stringify(r) !== JSON.stringify(before.find((b) => b.id === r.id))).map((r) => r.id + ':' + JSON.stringify(r.working ?? { model: r.model, maker: r.maker, hidden: r.hidden, status: r.status }).slice(0, 80))
  const rec = { col, text, gap, cursor: [c0, c1], mode: m, edit: ev, panel: pn, changedAfterEnter: changed, ok: ev === text }
  out.real.push(rec); console.log('REAL', rec.ok ? 'OK' : 'NG', text, gap, JSON.stringify(rec))
  await closeAll(page)
}
// V3-02: r → 待ち → 型式 → Enter
for (const wait of [150, 300, 380, 420, 450, 500, 700]) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toCol(page, '型式')
  const n0 = (await proj(page)).rows.length
  await page.keyboard.press('r'); await sleep(wait)
  const pnAt = await panel(page)
  await typeReal('MY4N-NEW', 40)
  const pn = await panel(page)
  const promptVal = pn === 'panel-prompt' ? await page.getByTestId('prompt-text').inputValue().catch(() => '(none)') : null
  await page.keyboard.press('Enter'); await sleep(300)
  // 理由などの追加ダイアログが出たら 1 → Enter
  for (let i = 0; i < 3 && (await panel(page)); i++) { const t = await page.locator('[data-testid^="panel-"]').innerText(); out.r.push({ wait, extraPanel: t.slice(0, 120) }); await page.keyboard.press('Escape'); await sleep(80) }
  const p = await proj(page)
  const r40 = p.rows.find((r) => r.id === 'R040')
  const rec = { wait, panelAtType: pnAt, panelAfterType: pn, promptVal, rows: [n0, p.rows.length], r40model: r40.working?.model ?? r40.model, newRows: p.rows.filter((r) => r.replaces === 'R040').map((r) => r.id + ':' + (r.working?.model ?? r.model)), toast: await toastNow(page) }
  out.r.push(rec); console.log('R', wait, JSON.stringify(rec))
  await closeAll(page)
}
dumpErrors(errors, '33-real')
save('33-real.json', out)
await browser.close()
