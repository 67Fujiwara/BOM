// 英字コマンドを使った直後（1.5 秒以内）に値を打つ: x で警告を確認 → → で隣のセル → 打つ / Esc でパネルを閉じてすぐ打つ / 誤って採用 → Ctrl+Z
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, typeReal, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t27_chain')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
// 警告のある行を探す（設計の 4 で x が「警告を確認済み」になる行）
await step('x then type', async () => {
  for (const [first, word, wait] of [['x', 'relay', 300], ['x', 'AC100V', 100], ['x', 'sensor', 300], ['h', 'heater', 300]]) {
    await fresh(page); await page.keyboard.press('4'); await sleep(200)
    const p = await proj(page)
    // 1 つ目の問題へ
    await page.keyboard.press('n'); await sleep(300)
    const u0 = await ui(page); const r0 = await snap()
    await page.keyboard.press(first); await sleep(500); const tx = await T.toast(page)
    await page.keyboard.press('ArrowRight'); await sleep(wait)
    const u1 = await ui(page)
    await typeReal(page, word, 80); await sleep(200)
    const u2 = await ui(page); const pt = await T.panelText(page)
    await page.keyboard.press('Enter'); await sleep(250)
    const t3 = await T.toast(page); if (await T.panel(page)) { log('   panel after Enter', (await T.panelText(page))?.slice(0, 120)); await page.keyboard.press('Escape') }
    log(`  ${first} on ${u0.cursorRow}/${u0.cursorCol} (${tx}) → ArrowRight to ${u1.cursorCol} → "${word}": mode=${u2.mode} edit=${JSON.stringify(u2.editValue)} panel=${pt?.slice(0, 100)} | Enter toast=${t3}`)
    log(`   changes: ${await changes(r0)}`)
    await shot(page, `t27_${first}_${word.replace(/\W/g, '_')}`)
  }
})
await step('recover by Ctrl+Z after accidental adopt (Analog Devices)', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R043'); await gotoCol(page, 'メーカ'); const r0 = await snap()
  await typeReal(page, 'Analog Devices', 60); await page.keyboard.press('Enter'); await sleep(250)
  log('  after: toast=', await T.toast(page), '| changes', await changes(r0))
  await page.keyboard.press('Control+z'); await sleep(250); log('  Ctrl+Z:', await T.toast(page), '| changes', await changes(r0))
})
await step('slow relay → replacement → Ctrl+Z', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '部品名'); const r0 = await snap()
  await typeReal(page, 'relay', 470); await page.keyboard.press('Enter'); await sleep(250)
  log('  after: toast=', await T.toast(page), '| changes', await changes(r0), '| cursor', (await ui(page)).cursorRow)
  await page.keyboard.press('Control+z'); await sleep(250); log('  Ctrl+Z:', await T.toast(page), '| changes', await changes(r0))
})
save(errors); await browser.close()
