// ラウンド8: 設計の新人。選択の列・日付の打ち直し、F8 で直すたびに次へ、順番に直すモード、公開、取消・置換・隠す、Ctrl+Z
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep, diff, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t63_design_flow')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); const d = diff(strip(r0 ?? {}), strip(r)); if (d) out.push(`${r.id}: ${d}`) } ; return out.join(' ; ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }

await step('A. 選択の列を Enter から打ち直す（単位 個→m、調達区分 相見積→指定商社、代替可否）', async () => {
  await fresh(page); await page.keyboard.press('1')
  for (const [id, col, word] of [['R030', '単位', 'm'], ['R031', '単位', 'pcs'], ['R032', '調達区分', 'sh'], ['R033', '代替可否', 'fuka'], ['R034', '単位', '本']]) {
    await sel(page, id); await gotoCol(page, col); const p0 = await proj(page)
    await page.keyboard.press('Enter'); await sleep(60); await state(`${id} ${col} Enter`)
    if (/^[\x20-\x7e]+$/.test(word)) await typeReal(page, word, 40); else await page.keyboard.insertText(word)
    await sleep(60); await state(`typed ${word}`)
    await page.keyboard.press('Enter'); await sleep(100); await state('Enter')
    log('  CHANGES:', await changes(p0))
    if ((await ui(page)).mode === 'edit') await page.keyboard.press('Escape')
  }
})
await step('B. 日付: 必要日(固定) を Enter → 11/30 → Enter / いきなり 2026/12/1', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030')
  // 必要日(固定) は既定で隠れているかもしれない
  const ok = await gotoCol(page, '必要日(固定)'); log('  col visible', ok)
  if (ok) {
    const p0 = await proj(page)
    await page.keyboard.press('Enter'); await sleep(60); await state('Enter'); await typeReal(page, '11/30', 40); await page.keyboard.press('Enter'); await sleep(80); log('  CHANGES:', await changes(p0))
  }
})
await step('C. F8 で問題へ → いきなり正しい値を打つ → Enter → F8 …（直すたびに F8）', async () => {
  await fresh(page); await sleep(150)
  const fixes = { model: 'XYZ-100 10A', maker: 'オムロン', qtyNeeded: '2', name: '部品' }
  const seen = []
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('F8'); await sleep(100)
    const u = await ui(page); const t = await T.toast(page)
    seen.push(`${u.cursorRow}/${u.cursorCol}`)
    if (/ありません/.test(t ?? '') && !u.cursorRow) { log('  toast', t); break }
    const v = fixes[u.cursorCol] ?? 'X'
    if (/[^\x20-\x7e]/.test(v)) await page.keyboard.insertText(v); else await typeReal(page, v, 20)
    await page.keyboard.press('Enter'); await sleep(100)
    log(`   fix ${u.cursorRow}/${u.cursorCol} <- ${v} | toast: ${await T.toast(page)} | mode ${(await ui(page)).mode}`)
    if ((await ui(page)).mode === 'edit') { await state('still edit'); await page.keyboard.press('Escape') }
  }
  log('  F8 order:', seen.join(' → '))
  await page.keyboard.press('F8'); await sleep(100); await state('F8 after all')
  await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter'); log('  panel', await T.panelText(page))
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(150); await state('Enter ' + i) }
})
await step('D. 順番に直すモード: Ctrl+Shift+F → Enter（編集する）→ Ctrl+A なしで打つ → Enter → 次 …', async () => {
  await fresh(page); await sleep(150)
  await page.keyboard.press('Control+Shift+F'); await sleep(150); await state('seq'); log('  panel', (await T.panelText(page))?.slice(0, 200))
  for (let i = 0; i < 4; i++) {
    if ((await ui(page)).panel !== 'quickfix') break
    const u0 = await ui(page)
    await page.keyboard.press('Enter'); await sleep(80); const u1 = await ui(page)
    log(`   ${u0.cursorRow}/${u0.cursorCol} Enter -> mode=${u1.mode} edit=${JSON.stringify(u1.editValue)}`)
    if (u1.mode === 'edit') { await page.keyboard.press('Control+a'); await page.keyboard.insertText(u1.cursorCol === 'maker' ? 'オムロン' : u1.cursorCol === 'qtyNeeded' ? '3' : 'NEW-1'); await page.keyboard.press('Enter'); await sleep(150) }
    await state('after fix ' + i)
  }
  await page.keyboard.press('Escape'); await sleep(80); await state('Esc')
})
await step('E. 取消（Shift+Delete）→ Ctrl+Enter → Ctrl+Z、置換（Alt+r）→ Ctrl+Z、隠す（Alt+h）→ 4 で見えるか → Ctrl+Z', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, '部品名')
  let p0 = await proj(page)
  await page.keyboard.press('Shift+Delete'); await sleep(100); await state('Shift+Delete')
  await page.keyboard.press('Control+z'); await sleep(100); await state('Ctrl+Z'); log('  CHANGES:', await changes(p0))
  await page.keyboard.press('Alt+KeyR'); await sleep(100); await page.keyboard.insertText('MY4N-GS DC24'); await page.keyboard.press('Enter'); await sleep(200); await state('replace')
  log('  CHANGES:', (await changes(p0)).slice(0, 400))
  await page.keyboard.press('Control+z'); await sleep(150); await state('Ctrl+Z replace'); log('  CHANGES after undo:', (await changes(p0)).slice(0, 300), '| rows', (await proj(page)).rows.length)
  await sel(page, 'R041'); await gotoCol(page, '部品名'); p0 = await proj(page)
  await page.keyboard.press('Alt+KeyH'); await sleep(100); await state('Alt+h')
  await page.keyboard.press('Alt+2'); await sleep(100); await state('Alt+2'); log('  R041 in view 2:', await page.locator('[data-row-id="R041"]').count())
  await page.keyboard.press('Control+z'); await sleep(100); await state('Ctrl+Z'); log('  CHANGES:', await changes(p0))
})
save(errors); await browser.close()
