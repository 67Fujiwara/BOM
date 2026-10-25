// ラウンド22: 順番に直すモードで「あとで（2）」「飛ばす（3）」を選ぶと、残りがあるのにモードが終わる（4 要確認／1 すべて）
import { launch, T, makeLog, ui, sleep, proj, runPalette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r94_seq_skip')
const mk = () => {
  const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
  for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
  for (let i = 1; i <= 6; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
  return ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
}
for (const view of [4, 1, 2]) for (const key of ['2', '3', '1']) {
  await wizardPaste(page, mk())
  await page.keyboard.press('Enter'); await sleep(500)
  await page.keyboard.press('Control+Enter'); await sleep(400)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  if (view !== 4) { await page.keyboard.press(`Alt+${view}`); await sleep(200) }
  await page.keyboard.press('F8'); await sleep(200)
  const u0 = await ui(page)
  const ok = await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(300)
  const u1 = await ui(page)
  const seq = []
  for (let i = 0; i < 3; i++) {
    const before = (await ui(page)).cursorRow
    if (!(await T.panel(page))) { seq.push('(panel なし)'); break }
    await page.keyboard.press(key); await sleep(250)
    const u = await ui(page)
    seq.push(`${before}→${u.cursorRow}${u.panel ? '' : '[終了]'}`)
  }
  log(`view ${view} key ${key}: start cursor=${u0.cursorRow}/${u0.cursorCol} palette=${ok} panel=${u1.panel} | steps: ${seq.join(' ')} | toast=${((await T.toast(page)) ?? '').slice(0, 90)}`)
}
save(errors); await browser.close()
