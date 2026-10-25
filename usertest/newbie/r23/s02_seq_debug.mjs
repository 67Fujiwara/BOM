import { launch, T, makeLog, ui, sleep, shot, proj, runPalette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's02_seq_debug')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 6; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
for (const view of [1, 4, 9]) {
  await wizardPaste(page, text)
  await page.keyboard.press('Enter'); await sleep(450)
  await page.keyboard.press('Control+Enter'); await sleep(350)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  if (view !== 1) { await page.keyboard.press(`Alt+${view}`); await sleep(250) }
  await page.keyboard.press('F8'); await sleep(200)
  const u0 = await ui(page)
  log(`== view ${u0.view} 開始前 cursor=${u0.cursorRow}/${u0.cursorCol}`)
  await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(350)
  for (let i = 0; i < 8; i++) {
    const u = await ui(page)
    if (!u.panel) { log(`  step ${i}: パネルなし cursor=${u.cursorRow}/${u.cursorCol} toast=${(await T.toast(page))?.slice(0, 100)}`); break }
    log(`  step ${i}: cursor=${u.cursorRow}/${u.cursorCol} panel=${u.panel} 見出し=${((await T.panelText(page)) ?? '').slice(0, 30)}`)
    await page.keyboard.press(view === 9 ? '2' : '2'); await sleep(250)
  }
}
save(errors); await browser.close()
