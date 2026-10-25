// 新人: Home（Excel の A 列のつもり）や ID のセルをクリックしてから値を打つ / 起動直後に打つ / F1 を編集中に押す
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, diff, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x02_idcol')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} sort=${JSON.stringify(u.sort)} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 300)}`) } ; if (p1.rows.length !== p0.rows.length) out.push(`rows ${p0.rows.length}->${p1.rows.length}`); if (p1.issues.length !== p0.issues.length) out.push(`issues ${p0.issues.length}->${p1.issues.length}`); return out.join(' ; ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }

for (const [role, id, word] of [['design', 'R005', 'relay'], ['design', 'R030', 'hai'], ['design', 'R030', 'MY4N'], ['purchasing', 'R033', 'ok'], ['purchasing', 'R013', 'zaiko ari'], ['design', 'R030', '12']]) {
  await step(`${role}: ${id} で Home（A 列のつもり）→「${word}」→ Enter`, async () => {
    await fresh(page, role); await sleep(150); await sel(page, id); await sleep(100)
    const p0 = await proj(page)
    await page.keyboard.press('Home'); await sleep(80); await st('Home')
    await typeReal(page, word, 40); await sleep(150); await st('typed')
    await page.keyboard.press('Enter'); await sleep(200); await st('Enter')
    log('  CHANGES:', await changes(p0))
    await shot(page, `x02_home_${role}_${word.replace(/\W/g, '_')}`)
  })
}
await step('design: ID のセルをマウスでクリック → 「hikoukai」（非公開と打つつもり）', async () => {
  await fresh(page); await sleep(150)
  const p0 = await proj(page)
  await page.locator('[data-row-id="R010"] td').first().click(); await sleep(100); await st('click id')
  await typeReal(page, 'hikoukai', 40); await sleep(150); await st('typed')
  log('  CHANGES:', await changes(p0))
  await page.keyboard.press('Control+z'); await sleep(100); await st('Ctrl+Z')
  log('  after undo CHANGES:', await changes(p0))
})
await step('design: 状態の列をクリック → 「mitsumori」', async () => {
  await fresh(page); await sleep(150)
  const p0 = await proj(page)
  const tds = page.locator('[data-row-id="R020"] td')
  const n = await tds.count(); const cls = []; for (let i = 0; i < Math.min(n, 6); i++) cls.push(await tds.nth(i).getAttribute('class'))
  log('  td classes', cls.join(' | '))
  await tds.nth(1).click(); await sleep(100); await st('click 2nd td')
  await typeReal(page, 'mitsumori', 40); await sleep(150); await st('typed')
  log('  CHANGES:', await changes(p0))
})
await step('起動直後（待たずに）打つ: 設計 「47」→ ↓ → 「relay」', async () => {
  await page.goto('http://localhost:5174/?fresh=' + Date.now())
  await page.keyboard.type('47', { delay: 0 })
  await page.getByTestId('grid').waitFor(); await sleep(300); await st('after 47')
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('ArrowDown'); await typeReal(page, 'relay', 0); await sleep(150); await st('↓ relay')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
})
await step('起動直後: グリッドに focus しないで打つ（クリックもしない）', async () => {
  await page.goto('http://localhost:5174/?fresh=' + Date.now()); await page.getByTestId('grid').waitFor(); await sleep(400)
  log('  active:', await page.evaluate(() => document.activeElement?.className + ' ' + document.activeElement?.tagName))
  await page.keyboard.press('ArrowDown'); await sleep(80); await st('↓')
  await typeReal(page, 'abc', 0); await sleep(100); await st('abc')
  await page.keyboard.press('Escape')
})
await step('編集中に F1 → Esc（途中の値はどうなる）', async () => {
  await fresh(page); await sleep(150); await sel(page, 'R030'); await gotoCol(page, '型式')
  const p0 = await proj(page)
  await page.keyboard.press('Enter'); await typeReal(page, 'XX', 30); await st('editing')
  await page.keyboard.press('F1'); await sleep(150); await st('F1')
  await page.keyboard.press('Escape'); await sleep(150); await st('Esc')
  log('  CHANGES:', await changes(p0))
  log('== 打ち始め（Enter なし）で F1')
  const p1 = await proj(page)
  await page.keyboard.press('ArrowDown'); await typeReal(page, 'ABC', 30); await st('typed ABC'); await page.keyboard.press('F1'); await sleep(150); await st('F1'); await page.keyboard.press('Escape'); await sleep(100); await st('Esc')
  log('  CHANGES:', await changes(p1))
  log('== 編集中に Ctrl+K → Esc')
  const p2 = await proj(page)
  await page.keyboard.press('ArrowDown'); await typeReal(page, 'QQ', 30); await page.keyboard.press('Control+k'); await sleep(150); await st('Ctrl+K'); await page.keyboard.press('Escape'); await sleep(100); await st('Esc')
  log('  CHANGES:', await changes(p2))
  log('== 編集中に Ctrl+F')
  const p3 = await proj(page)
  await page.keyboard.press('ArrowDown'); await typeReal(page, 'ZZ', 30); await page.keyboard.press('Control+f'); await sleep(150); await st('Ctrl+F'); await page.keyboard.press('Escape'); await sleep(100); await st('Esc')
  log('  CHANGES:', await changes(p3))
})
save(errors); await browser.close()
