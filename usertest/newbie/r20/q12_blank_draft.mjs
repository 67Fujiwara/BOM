// ラウンド14: U13-05 の修正の確かめ: 部品名も型式も無い下書きの行がある BOM の Ctrl+Enter（全部が空・一部が空）
import { launch, fresh, T, makeLog, proj, sleep, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('q12_blank_draft')
for (const [title, text] of [['全部の行に部品名・型式が無い', 'メーカー\t数量\nオムロン\t4\nIDEC\t2'], ['1 行だけ部品名・型式が無い（中ほどの表題）', 'No\t品名\t型式\tメーカー\t数量\n1\tリレー\tMY4N-D2\tオムロン\t4\n制御盤A 部品表\t\t\t\t2/2\n2\tタイマ\tH3CR-A8\tオムロン\t2']]) {
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(text); await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
  log('== ' + title + ' | created: ' + (await T.toast(page)))
  await page.keyboard.press('Control+Enter'); await sleep(250); log('   Ctrl+Enter -> ' + (await T.toast(page)))
  const p = await proj(page); log('   rows: ' + p.rows.map((r) => `${r.id}:${r.status}:${r.name}/${r.model}/${r.qtyNeeded}`).join(' '))
}
save(errors); await browser.close()
