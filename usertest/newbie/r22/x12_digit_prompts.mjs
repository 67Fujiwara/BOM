// 「数字か ↑↓ で選び、○○を入れて Enter」の案内どおりに 数字 → 文字 → Enter
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x12_digit_prompts')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} user=${u.user} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 160)} | toast: ${await T.toast(page)}`) }
log('== 役割を切り替え: Ctrl+K「役割」→ 2（購買）→ 氏名「tanaka」→ Enter')
await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(50)
await runPalette(page, '役割', '役割を切り替え'); await sleep(150); await st('prompt')
await page.keyboard.press('2'); await sleep(150); await st('2')
await typeReal(page, 'tanaka', 30); await st('tanaka'); await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
log('== 同じ: 設計に戻る → 1 → 「yamada」')
await runPalette(page, '役割', '役割を切り替え'); await sleep(150); await page.keyboard.press('1'); await sleep(150); await st('1')
await typeReal(page, 'yamada', 30); await page.keyboard.press('Enter'); await sleep(150); await st('yamada Enter')
let p = await proj(page); log('  workings', JSON.stringify(p.rows.filter((r) => r.working && Object.keys(r.working).length && !/R07[6-9]|R080/.test(r.id)).map((r) => [r.id, r.working])))
log('== 設計: R005（見積済）で 1 位以外の商社を選ぶ → 理由 2 → 補足「nouki」→ Enter')
await fresh(page); await sel(page, 'R005'); await gotoCol(page, '部品名')
await page.keyboard.press('Alt+Shift+A'); await sleep(150); await st('Alt+Shift+A')
await page.keyboard.press('2'); await sleep(150); await st('2 (2 番目の商社)')
if ((await ui(page)).panel) { const t = await T.panelText(page); if (/1 位以外|1位以外/.test(t)) { await page.keyboard.press('2'); await sleep(150); await st('理由 2') } else { await page.keyboard.press('a'); await sleep(150); await st('a'); await page.keyboard.press('2'); await sleep(150); await st('理由 2') } }
await typeReal(page, 'nouki', 30); await st('nouki'); await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
p = await proj(page); const r5 = p.rows.find((r) => r.id === 'R005'); log('  R005', r5.status, r5.adoptedSupplierId, r5.adoptReason, '| workings', JSON.stringify(p.rows.filter((r) => r.working && Object.keys(r.working).length && !/R07[6-9]|R080/.test(r.id)).map((r) => [r.id, r.working])))
await shot(page, 'x12_adopt_reason')
save(errors); await browser.close()
