// 画面の案内（n で次の問題へ / x で確認済みに）どおりに押した新人の値がそのまま公開される
import { launch, fresh, T, makeLog, shot, ui, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t38_guided_trap')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | toast: ${await T.toast(page)}`) }
const dump = async (tag) => { const p = await proj(page); log(`  ${tag}: ` + p.rows.map((r) => `${r.id}{${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.status}|pub=${r.publishedRev ?? '-'}}`).join(' ')) }
const wizard = async (id, tsv) => {
  await fresh(page)
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await sleep(60); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill(id); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(80); await page.getByTestId('wizard-paste').fill(tsv); await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(300)
}
log('== A. エラー（メーカ空）: 作成直後の案内「n で次の問題へ」→ n → Enter → Ctrl+Enter')
await wizard('TRAP-A', '品名\t形式\tメーカー\t員数\nリレー\tMY4N-D2\t\t4\nタイマ\tH3CR-A8\tオムロン\t2')
await state('created'); await dump('created')
await page.keyboard.press('n'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150); await state('n Enter')
await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter'); if (await T.panel(page)) { log('  panel', await T.panelText(page)); await page.keyboard.press('Enter'); await sleep(200) }
await dump('after publish'); await shot(page, 't38_A_published_maker_n')
log('== B. 警告（全角の型式）: Ctrl+Enter の案内「直すか x で確認済みに」→ x → Enter → Ctrl+Enter')
await wizard('TRAP-B', '品名\t形式\tメーカー\t員数\nリレー\tＭＹ４Ｎ\tオムロン\t4')
await state('created'); await dump('created')
await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter (blocked?)')
await page.keyboard.press('x'); await sleep(80); await state('x'); await page.keyboard.press('Enter'); await sleep(150); await state('Enter')
await page.keyboard.press('Control+Enter'); await sleep(200); await state('Ctrl+Enter'); if (await T.panel(page)) { log('  panel', await T.panelText(page)); await page.keyboard.press('Enter'); await sleep(200) }
await dump('after publish'); await shot(page, 't38_B_published_model_x')
save(errors); await browser.close()
