// ラウンド13: 新人の購買が指摘を起票（種別を選ばずにいきなり本文を打つ／数字で始まる本文）→ 発行 → 設計が返信 → 購買が確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v10_issue13')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 200) ?? ''} | toast: ${await T.toast(page)}`) }
const iss = async () => (await proj(page)).issues.map((i) => `${i.id}:${i.rowId}/${i.kind}/${i.status}/「${i.text}」${i.replies?.length ? ' replies=' + JSON.stringify(i.replies.map((r) => r.text)) : ''}`).slice(-3).join(' ')
async function raise(title, keys) {
  log('== ' + title)
  await fresh(page, 'purchasing'); await sleep(100); await sel(page, 'R030'); await sleep(80)
  await page.keyboard.press('Alt+Shift+I'); await sleep(150); await st('Alt+Shift+I')
  for (const k of keys) { if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else if (k.startsWith('i:')) await page.keyboard.insertText(k.slice(2)); else await page.keyboard.press(k); await sleep(80) }
  await st('typed')
  await page.keyboard.press('Enter'); await sleep(150); await st('Enter')
  log('  issues: ' + (await iss()))
}
await raise('A 種別を選ばずに本文を打つ（kakaku ga takai）', ['t:kakaku ga takai'])
await raise('B 種別を選ばずに本文を打つ（moq 100 ko）', ['t:moq 100 ko'])
await raise('C 数字で始まる本文（1 で種別を選んで、3個単位です）', ['1', 't:3', 'i:個単位です'])
await raise('D 種別 m → 本文「MOQ 100」', ['m', 't:MOQ 100'])
// 発行 → 設計が返信 → 購買が確認
log('== E 起票 → Ctrl+Enter で発行 → 設計 → 返信 → 購買 確認')
await fresh(page, 'purchasing'); await sel(page, 'R030'); await page.keyboard.press('Alt+Shift+I'); await sleep(120); await page.keyboard.press('k'); await typeReal(page, 'kataban wo kakunin'); await page.keyboard.press('Enter'); await sleep(150)
await st('raised'); log('  issues: ' + (await iss()))
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter'); if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200); await st('Enter') }
log('  issues: ' + (await iss()))
await setRole(page, 'design'); await sleep(150); await st('design')
await sel(page, 'R030'); await sleep(80); await page.keyboard.press('Space'); await sleep(150); await st('Space')
await shot(page, 'v10_design_space')
save(errors); await browser.close()
