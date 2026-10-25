// 順番に直すモード: 飛ばすたびに 2 つ進む・一周の通知のあとに開いたままの候補（証跡のスクリーンショット）
import { launch, fresh, T, makeLog, ui, sleep, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w05b_seq_shot')
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(300)
for (let i = 0; i < 6; i++) {
  const u = await ui(page); const t = (await T.panelText(page)) ?? ''
  log(`step ${i}: cursor=${u.cursorRow}/${u.cursorCol} panel=${u.panel} title=${t.slice(0, 40)} toast=${await T.toast(page)}`)
  await shot(page, `w05b_step${i}`)
  const m = /(\d) 飛ばして次の問題へ/.exec(t); if (!m) break
  await page.keyboard.press(m[1]); await sleep(400)
}
save(errors); await browser.close()
