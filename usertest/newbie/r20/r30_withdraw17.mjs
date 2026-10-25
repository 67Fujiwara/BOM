// ラウンド17: 正式見積を依頼したあとで設計が部品を取り消す → 購買の新人が F8 で回り、ステータスバーの案内のとおり取下げを伝えた印を付ける（新人では初めて）。
// M16-01 / U16-01（中堅）の直し（F8 で取消・置換した行の取下げに回る）を新人の操作で
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, setRole, sel, runPalette, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r30_withdraw17')
const rs = async (id) => { const p = await proj(page); const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:cancel=${!!r.cancelled}:flags=${JSON.stringify(r.flags)}` }
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | hints: ${(await T.hints(page)).slice(0, 220)} | toast: ${(await T.toast(page))?.slice(0, 200)}`) }
await fresh(page, 'purchasing'); await sleep(200)
log('== 購買: 正式見積を依頼 → 確認で Enter（既定は「やめる」）→ もう一度開いて 2 → Enter')
const sel0 = (await proj(page)).rows.filter((r) => r.status === 'selected').map((r) => r.id)
log('  選定済: ' + sel0.join(' '))
await runPalette(page, '正式見積を依頼'); await sleep(200)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 200))
await page.keyboard.press('Enter'); await sleep(400)
log('  toast: ' + (await T.toast(page)))
await runPalette(page, '正式見積を依頼'); await sleep(200)
await page.keyboard.press('2'); await sleep(200)
if (await T.panel(page)) { log('  2 のあと panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 100)); await page.keyboard.press('Enter'); await sleep(400) }
log('  toast: ' + (await T.toast(page)))
for (const id of sel0) log('  ' + (await rs(id)))
const target = sel0[0]
log(`== 設計: ${target} を「行を削除」（パレット）→ 確認 → Ctrl+Enter → 理由 3 → Enter`)
await setRole(page, 'design'); await sleep(200); await page.keyboard.press('1'); await sleep(100)
await sel(page, target); await sleep(100)
await runPalette(page, '行を削除'); await sleep(200)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 200) + ' | toast ' + (await T.toast(page)))
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(250) }
log('  toast: ' + (await T.toast(page)) + ' | ' + (await rs(target)))
await page.keyboard.press('Control+Enter'); await sleep(250)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 200))
if (await T.panel(page)) { await page.keyboard.press('3'); await page.keyboard.press('Enter'); await sleep(300) }
log('  toast: ' + (await T.toast(page)) + ' | ' + (await rs(target)))
log('== 購買: 受信箱・F8 で回る → 案内のとおり x')
await setRole(page, 'purchasing'); await sleep(250)
await st('purchasing start')
await clearToast(page)
await page.keyboard.press('F8'); await sleep(250); await st('F8 1')
await shot(page, 'r30_F8_1')
const u = await ui(page)
if (u.cursorRow === target) {
  await page.keyboard.press('x'); await sleep(250); await st('x')
  log('  ' + (await rs(target)))
} else {
  for (let i = 0; i < 8; i++) { await page.keyboard.press('F8'); await sleep(200); const u2 = await ui(page); await st('F8 ' + (i + 2)); if (u2.cursorRow === target) { await st('F8 found'); break } }
  await page.keyboard.press('x'); await sleep(250); await st('x')
  log('  ' + (await rs(target)))
}
await page.keyboard.press('F8'); await sleep(250); await st('F8 after x')
await shot(page, 'r30_after_x')
log('== 購買: ビュー 4 要確認 に切り替えて F8 → x（ステータスバーの案内のとおり）')
await page.keyboard.press('Escape'); await page.keyboard.press('4'); await sleep(250); await st('4')
await page.keyboard.press('Alt+4'); await sleep(250); await st('知らせのとおり Alt+4')
log('  view4 rows: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))).join(','))
for (let i = 0; i < 4; i++) { await page.keyboard.press('F8'); await sleep(200); const u2 = await ui(page); await st('v4 F8 ' + (i + 1)); if (u2.cursorRow === target) break }
await shot(page, 'r30_view4_F8')
await page.keyboard.press('x'); await sleep(250); await st('v4 x')
log('  ' + (await rs(target)))
log('== 受信箱（Ctrl+K 受信箱）に取下げは出ているか')
await runPalette(page, '受信箱'); await sleep(250)
log('  panel: ' + ((await T.panelText(page)) ?? '-').slice(0, 300))
await page.keyboard.press('Escape')
save(errors); await browser.close()
