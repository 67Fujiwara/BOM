// ラウンド19: 新人がまだ通っていない流れ「発注後の変更」（§4・§9.1）。購買が正式見積を依頼 → 正式単価を入れる → 発注 →
// 設計の新人が発注済の行の型式を直そうとする → 出た案内のとおりに操作 → 購買が発注後変更依頼 → PM 承認 → 購買が発注を外す → 設計が置き換え
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, setRole, sel, gotoCol, runPalette, clearToast, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r46_postorder19')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const ID = 'R001'
const rs = async (id = ID) => { const p = await proj(page); const r = p.rows.find((x) => x.id === id); if (!r) return id + ':なし'; return `${id}:${r.status} ordered=${r.ordered} model=${r.model} working=${JSON.stringify(r.working ?? null)} removal=${JSON.stringify(r.removal ?? null)} flags=${JSON.stringify(r.flags)} replacedBy=${r.replacedBy ?? '-'}` }
const iss = async () => (await proj(page)).issues.filter((i) => i.rowId === ID || i.kind === '発注後変更依頼').map((i) => `${i.id}:${i.rowId}/${i.kind}/${i.status}${i.pmRuled ? '/pmRuled' : ''}「${(i.text ?? '').slice(0, 30)}」`).join(' ')
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 220)} | toast=${(await T.toast(page))?.slice(0, 240)}`) }
const hints = async () => log('  hints: ' + (await T.hints(page)).slice(0, 220) + ' | status: ' + (await T.status(page)).replace(/\s+/g, ' ').slice(0, 260))
await fresh(page, 'purchasing'); await sleep(200)
await step('1 購買: 正式見積を依頼（2 → Enter）', async () => {
  await runPalette(page, '正式見積を依頼'); await sleep(200)
  await page.keyboard.press('2'); await sleep(150)
  if (await T.panel(page)) await page.keyboard.press('Enter')
  await sleep(400); await U('依頼'); log('  ' + (await rs()))
})
await step('2 購買: 8 正式見積 で R001 の正式単価に概算と同じ単価を打つ', async () => {
  const p = await proj(page); const r = p.rows.find((x) => x.id === ID); const q = p.quotes.find((x) => x.rowId === ID && x.supplierId === r.adoptedSupplierId && !x.stale)
  log(`  概算: ${q.unitPrice} 円 / ${q.leadDays} 日`)
  await page.keyboard.press('Alt+8'); await sleep(200); await sel(page, ID)
  for (let i = 0; i < 30; i++) { const c = await T.cursor(page); if (/正式単価|正式/.test(c)) break; await page.keyboard.press('ArrowRight') }
  await U('at 正式単価?')
  await typeReal(page, String(q.unitPrice), 20); await page.keyboard.press('Enter'); await sleep(250); await U('正式単価 Enter')
  log('  ' + (await rs()))
  if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await sleep(150); await U('Esc（自動で始まった次の行の入力をやめる）') }
})
await step('3 購買: 3 発注・入荷 → R001 の発注の列で Enter', async () => {
  await page.keyboard.press('Alt+3'); await sleep(200); await sel(page, ID); log(`  col 発注 ${await gotoCol(page, '発注')}`)
  await page.keyboard.press('Enter'); await sleep(250); await U('発注 Enter'); log('  ' + (await rs()))
})
await step('4 設計の新人: R001 の型式を直そうとする → 案内のとおり Alt+Shift+I → h', async () => {
  await setRole(page, 'design'); await sleep(200); await page.keyboard.press('Alt+1'); await sleep(150)
  await sel(page, ID); await gotoCol(page, '型式'); await clearToast(page)
  await typeReal(page, 'FX5U-32MT', 20); await page.keyboard.press('Enter'); await sleep(250); await U('型式を打って Enter')
  log('  ' + (await rs())); await hints()
  await page.keyboard.press('Alt+Shift+I'); await sleep(250); await U('Alt+Shift+I')
  await page.keyboard.press('h'); await sleep(250); await U('h')
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
  if ((await ui(page)).panel) { await page.keyboard.press('Escape'); await sleep(150) }
})
await step('5 設計の新人: 起票できる「質問」で購買に頼む → Ctrl+Enter', async () => {
  await sel(page, ID); await gotoCol(page, '型式')
  await page.keyboard.press('Alt+Shift+I'); await sleep(200); await U('Alt+Shift+I')
  await page.keyboard.press('q'); await sleep(150)
  await page.keyboard.insertText('型式を FX5U-32MT に変えたいです。発注後変更依頼をお願いします'); await page.keyboard.press('Enter'); await sleep(250); await U('質問 Enter')
  log('  issues: ' + (await iss()))
  await page.keyboard.press('Control+Enter'); await sleep(300); await U('Ctrl+Enter')
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { if ((await ui(page)).panel === 'prompt' && /理由/.test((await T.panelText(page)) ?? '')) await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(250); await U('2 Enter ' + i) }
  for (let i = 0; i < 2 && (await T.panel(page)); i++) { await page.keyboard.press('Escape'); await sleep(150) }
  log('  issues: ' + (await iss())); log('  ' + (await rs()))
})
await step('6 購買の新人: R001 で発注後変更依頼（Alt+Shift+I → h → 本文 → Enter → Ctrl+Enter）', async () => {
  await setRole(page, 'purchasing'); await sleep(250); await hints()
  await page.keyboard.press('Alt+1'); await sleep(150); await sel(page, ID); await gotoCol(page, '型式'); await hints()
  await page.keyboard.press('Alt+Shift+I'); await sleep(200); await U('Alt+Shift+I')
  await page.keyboard.press('h'); await sleep(200); await U('h')
  await page.keyboard.insertText('設計から型式変更（FX5U-32MT）の依頼。発注を取り消してよいか'); await page.keyboard.press('Enter'); await sleep(250); await U('本文 Enter')
  await page.keyboard.press('Control+Enter'); await sleep(300); await U('Ctrl+Enter')
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(250); await U('Enter ' + i) }
  log('  issues: ' + (await iss())); log('  ' + (await rs()))
})
await step('7 PM の新人: 7 要決定 → R001 で y（承認）→ 理由 → Enter', async () => {
  await setRole(page, 'pm'); await sleep(250); await hints()
  log('  v7: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id') + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 60)))).join(' / ').slice(0, 400))
  await sel(page, ID); await hints()
  await page.keyboard.press('Enter'); await sleep(250); await U('Enter（決定パネル）')
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
  await page.keyboard.press('y'); await sleep(250); await U('y')
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { if ((await ui(page)).panel === 'prompt') await page.keyboard.insertText('型式変更を承認'); await page.keyboard.press('Enter'); await sleep(250); await U('Enter ' + i) }
  log('  issues: ' + (await iss())); log('  ' + (await rs()))
})
await step('8 購買の新人: 案内のとおり発注を外す（3 → R001 の発注で Enter）', async () => {
  await setRole(page, 'purchasing'); await sleep(250); await hints()
  for (let i = 0; i < 8; i++) { await page.keyboard.press('F8'); await sleep(200); const u = await ui(page); log(`  F8 ${i + 1}: ${u.cursorRow}/${u.cursorCol} | ${(await T.status(page)).replace(/\s+/g, ' ').slice(0, 200)}`); if (u.cursorRow === ID) break }
  await page.keyboard.press('Alt+3'); await sleep(200); await sel(page, ID); await gotoCol(page, '発注'); await hints()
  await page.keyboard.press('Enter'); await sleep(250); await U('発注 Enter（外す）')
  for (let i = 0; i < 2 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(250); await U('Enter ' + i) }
  log('  issues: ' + (await iss())); log('  ' + (await rs()))
})
await step('9 設計の新人: 4 要確認 → F8 → 案内のとおり置き換え（Alt+r → 型式 → Enter）→ Ctrl+Enter', async () => {
  await setRole(page, 'design'); await sleep(250); await hints()
  await page.keyboard.press('F8'); await sleep(200); await U('F8'); await hints()
  await sel(page, ID); await hints()
  await page.keyboard.press('Alt+r'); await sleep(200); await U('Alt+r')
  if ((await ui(page)).panel === 'prompt') { await page.getByTestId('prompt-text').fill('FX5U-32MT'); await page.keyboard.press('Enter'); await sleep(300); await U('置換 Enter') }
  for (let i = 0; i < 2 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(250); await U('Enter ' + i) }
  const p = await proj(page); log('  last rows: ' + p.rows.slice(-2).map((r) => `${r.id}:${r.model}/${r.status}/replaces=${r.replaces ?? '-'}`).join(' '))
  log('  ' + (await rs()))
  await page.keyboard.press('Control+Enter'); await sleep(300); await U('Ctrl+Enter')
  if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(300); await U('理由 2 Enter') }
  log('  issues: ' + (await iss())); log('  ' + (await rs()))
  const p2 = await proj(page); log('  last rows: ' + p2.rows.slice(-2).map((r) => `${r.id}:${r.model}/${r.status}/replaces=${r.replaces ?? '-'}`).join(' '))
})
await step('10 購買: 元の行と置き換えの行はどこに出るか（9 購買作業・受信箱）', async () => {
  await setRole(page, 'purchasing'); await sleep(250); await hints()
  log('  v9: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id') + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 70)))).filter((t) => /R001|R08\d/.test(t)).join(' / '))
  await page.keyboard.press('F8'); await sleep(200); await U('F8'); await hints()
})
await shot(page, 'r46_end')
save(errors); await browser.close()
