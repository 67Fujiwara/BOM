// 公開が止まったときの案内（n で移動・x で確認済み）どおりに押す新人
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t31_publish_msgs')
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
await step('A. 設計：最初の行の部品名で Ctrl+Enter → 案内どおり n → x → Enter', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(100)
  const r0 = await snap()
  await page.keyboard.press('Control+Enter'); await sleep(250); await state('Ctrl+Enter'); log('  panel:', await T.panelText(page)); await shot(page, 't31_A_publish_blocked')
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(100) }
  await page.keyboard.press('n'); await sleep(150); await state('n (案内どおり)')
  await page.keyboard.press('x'); await sleep(150); await state('x (案内どおり)')
  await page.keyboard.press('Enter'); await sleep(200); await state('Enter'); await shot(page, 't31_A_nx')
  log('  changes:', await changes(r0))
})
await step('B. 案内に Alt / F8 を使った新人（F8 → Alt+x → Ctrl+Enter）', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); const r0 = await snap()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Control+Enter'); await sleep(200)
    const t = await T.toast(page); const pt = await T.panelText(page)
    log(`  try ${i}: toast=${t} panel=${pt?.slice(0, 160)}`)
    if (pt) break
    if (/公開できません/.test(t ?? '')) { await page.keyboard.press('F8'); await sleep(150); await state('F8'); await page.keyboard.press('Alt+x'); await sleep(150); await state('Alt+x') } else break
  }
  log('  changes:', await changes(r0))
})
await step('C. ガイドで作った表：作成直後の案内「n で次の問題へ」どおり n', async () => {
  await fresh(page)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill('NEW-6'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(100)
  await page.getByTestId('wizard-paste').fill('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\t\t4\nタイマ\t\tオムロン\t2\nヒューズ\tABC\tOmron\t0')
  await page.keyboard.press('Control+Enter'); await sleep(150); log('  step9:', (await T.panelText(page))?.slice(0, 300))
  await page.keyboard.press('Enter'); await sleep(300); await state('created')
  const r0 = await snap()
  await page.keyboard.press('n'); await sleep(150); await state('n'); await page.keyboard.press('Enter'); await sleep(150); await state('Enter')
  log('  changes:', await changes(r0)); await shot(page, 't31_C_after_n')
})
await step('D. h で隠した行を「h でもう一度押すと戻る」どおり戻す', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('Home'); await sleep(100)
  await page.keyboard.press('h'); await sleep(200); await state('h on ID')
  await page.keyboard.press('h'); await sleep(200); await state('h again')
  await sel(page, 'R031'); await gotoCol(page, '部品名'); await page.keyboard.press('Alt+h'); await sleep(200); await state('Alt+h on 部品名')
  const u = await ui(page); log('  cursor after hiding:', u.cursorRow, u.cursorCol)
  await page.keyboard.press('h'); await sleep(150); await state('h again (on typable)')
  await page.keyboard.press('Escape')
  const p = await proj(page); log('  R031 hidden:', p.rows.find((r) => r.id === 'R031').hidden)
})
save(errors); await browser.close()
