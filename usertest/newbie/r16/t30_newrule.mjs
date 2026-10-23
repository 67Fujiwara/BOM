// ラウンド6: 新しい英字の規則（文字を打てるセルでは英字＝入力、コマンドは Alt / F8 / Ctrl+Alt+A）を新人が見つけて使えるか
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, row, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t30_newrule')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }

await step('A. 設計の新人、初めて開く（4 要確認）', async () => {
  await fresh(page); await sleep(300)
  await state('open'); await shot(page, 't30_A_open')
  const banner = await page.locator('main').innerText().catch(() => ''); log('  top text:', banner.replace(/\s+/g, ' ').slice(0, 400))
  await page.keyboard.press('ArrowDown'); await sleep(150); await state('after ↓')
})
await step('B. 4 で n（仕様書・以前の癖の「次の問題」）を押してしまう → Enter', async () => {
  await fresh(page); await sleep(200)
  await page.keyboard.press('ArrowDown'); await sleep(100)
  const r0 = await snap(); await state('before')
  await page.keyboard.press('n'); await sleep(150); await state('after n'); await shot(page, 't30_B_n')
  await page.keyboard.press('Enter'); await sleep(200); await state('after Enter')
  log('  changes:', await changes(r0))
  await page.keyboard.press('Control+z'); await sleep(200); log('  Ctrl+Z:', await T.toast(page), '| changes', await changes(r0))
})
await step('C. F8 で問題へ → Alt+x で確認 → Ctrl+.', async () => {
  await fresh(page); await sleep(200)
  const r0 = await snap()
  await page.keyboard.press('F8'); await sleep(200); await state('F8'); await shot(page, 't30_C_F8')
  await page.keyboard.press('F8'); await sleep(200); await state('F8 2')
  await page.keyboard.press('Alt+x'); await sleep(200); await state('Alt+x')
  log('  changes:', await changes(r0))
  await page.keyboard.press('Control+.'); await sleep(200); await state('Ctrl+.'); log('  panel:', await T.panelText(page)); await shot(page, 't30_C_quickfix')
  await page.keyboard.press('Escape')
})
await step('D. 4 で x を押す（Alt なし）→ Enter', async () => {
  await fresh(page); await sleep(200)
  await page.keyboard.press('F8'); await sleep(200); await state('F8')
  const r0 = await snap()
  await page.keyboard.press('x'); await sleep(150); await state('x')
  await page.keyboard.press('Enter'); await sleep(200); await state('Enter')
  log('  changes:', await changes(r0))
})
await step('E. ID 列で n / x / Shift+I（Alt なし）', async () => {
  await fresh(page); await sleep(200)
  await page.keyboard.press('F8'); await sleep(200); await page.keyboard.press('Home'); await sleep(100); await state('Home')
  const r0 = await snap()
  await page.keyboard.press('n'); await sleep(200); await state('n on ID')
  await page.keyboard.press('Home'); await page.keyboard.press('x'); await sleep(200); await state('x on ID')
  await page.keyboard.press('Shift+I'); await sleep(200); await state('Shift+I on ID'); log('  panel:', await T.panelText(page))
  await page.keyboard.press('Escape'); log('  changes:', await changes(r0))
})
await step('F. 見積済の行で Alt+a（Alt を付ければコマンド、と覚えた新人）と Ctrl+Alt+A / a(ID列) の違い', async () => {
  // 推奨と最安が違う行を探す
  await fresh(page); await page.keyboard.press('1'); await sleep(200)
  const info = await page.evaluate(async () => {
    const S = await import('/src/model/store.ts'); const Sc = await import('/src/model/score.ts')
    const s = S.useStore.getState(); const p = s.project(); const out = []
    for (const r of p.rows.filter((r) => r.status === 'quoted')) { const sc = Sc.scoreRow(p, r, s.ws.suppliers); if (sc.length < 2) continue; const ch = [...sc].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]; if (ch.supplierId !== sc[0].supplierId) out.push([r.id, sc[0].supplierId, sc[0].total, ch.supplierId, ch.total]) }
    return out
  })
  log('  rows where cheapest != recommended:', JSON.stringify(info.slice(0, 12)), 'count', info.length)
  const target = info[0]?.[0] ?? 'R030'
  for (const keys of ['Alt+a', 'Control+Alt+a']) {
    await fresh(page); await page.keyboard.press('1'); await sel(page, target); await gotoCol(page, '型式'); await sleep(100)
    await state('before ' + keys)
    const r0 = await snap()
    await page.keyboard.press(keys); await sleep(250)
    await state('after ' + keys); log('  panel:', await T.panelText(page))
    if (await T.panel(page)) { await shot(page, `t30_F_${keys.replace(/\W/g, '')}`); await page.keyboard.press('Escape') }
    log('  changes:', await changes(r0))
    const pr = await proj(page); log('  decisions:', JSON.stringify(pr.decisions.slice(-2)).slice(0, 300))
  }
})
await step('G. 購買 6 商社別：単価セルで a / Alt+a / Shift+I', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('6'); await sleep(300); await state('6 open'); await shot(page, 't30_G_6')
  await page.keyboard.press('ArrowDown'); await sleep(100); await state('6 ↓')
  const r0 = await snap()
  await page.keyboard.press('a'); await sleep(150); await state('a'); await page.keyboard.press('Enter'); await sleep(200); await state('a Enter')
  log('  changes:', await changes(r0))
  await page.keyboard.press('Shift+I'); await sleep(150); await state('Shift+I'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
})
await step('H. 購買 9 購買作業：発注数で o / Alt+o', async () => {
  await fresh(page, 'purchasing'); await sleep(300); await state('9 open')
  await sel(page, 'R013'); await sleep(150); await state('R013')
  for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/発注数/.test(c)) break; await page.keyboard.press('ArrowRight') }
  const r0 = await snap(); await state('at 発注数')
  await page.keyboard.press('o'); await sleep(150); await state('o'); await page.keyboard.press('Escape'); await sleep(100)
  await page.keyboard.press('Alt+o'); await sleep(200); await state('Alt+o'); log('  changes:', await changes(r0))
})
await step('I. ? ヘルプとパレット「次の問題」「確認済」「採用」', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('?'); await sleep(250)
  const ht = await page.locator('.overlay').innerText(); log('  help head:', ht.replace(/\s+/g, ' ').slice(0, 600)); await shot(page, 't30_I_help')
  log('  help has Alt+A line:', /最安で採用/.test(ht), ' F8:', /F8/.test(ht))
  await page.keyboard.press('Escape')
})
await step('I2. ? を打てるセルで押す（値の入力の ? ではなくヘルプ）', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '備考'); await state('備考')
  await page.keyboard.press('?'); await sleep(150); await state('after ?'); await page.keyboard.press('Escape')
})
save(errors); await browser.close()
