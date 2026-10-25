// ラウンド23 s07: 【削除？】の行が多いとき、4（要確認）と 1（すべて）で F8／Shift+F8 を押していくと全部の行を回れるか（順番に直すモードを使わない新人）
import { launch, T, makeLog, ui, sleep, proj } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's07_f8_walk')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 6; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 8; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
for (const view of [4, 1]) {
  await wizardPaste(page, text)
  await page.keyboard.press('Enter'); await sleep(500)
  await page.keyboard.press('Control+Enter'); await sleep(350)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  await page.keyboard.press(`Alt+${view}`); await sleep(250)
  const seen = []
  for (let i = 0; i < 12; i++) { await page.keyboard.press('F8'); await sleep(150); const u = await ui(page); seen.push(`${u.cursorRow}/${u.cursorCol}`) }
  log(`view ${view} F8×12: ${seen.join(' ')}`)
  const back = []
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+F8'); await sleep(150); const u = await ui(page); back.push(`${u.cursorRow}/${u.cursorCol}`) }
  log(`   Shift+F8×4: ${back.join(' ')}`)
  // Ctrl+. で 1 → 次の問題へ F8
  await page.keyboard.press('Control+.'); await sleep(200); await page.keyboard.press('1'); await sleep(250)
  const u = await ui(page); log(`   Ctrl+. → 1: cursor=${u.cursorRow}/${u.cursorCol} panel=${u.panel} toast=${((await T.toast(page)) ?? '').slice(0, 100)}`)
  await page.keyboard.press('F8'); await sleep(150); const u2 = await ui(page); log(`   F8: ${u2.cursorRow}/${u2.cursorCol}`)
}
save(errors); await browser.close()
