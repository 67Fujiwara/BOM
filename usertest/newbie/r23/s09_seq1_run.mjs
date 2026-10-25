// ラウンド23 s09: 4（要確認）で【削除？】30 行の順番に直すモードを 1 の連打で片付ける。1 回ごとに 行・残り・モードの終了を記録（途中で終わらないか）
import { launch, T, makeLog, ui, sleep, proj, runPalette } from './lib.mjs'
import { wizardPaste } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's09_seq1_run')
const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
for (let i = 1; i <= 12; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
for (let i = 1; i <= 30; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
const text = ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
const flagged = async () => (await proj(page)).rows.filter((r) => String(r.note ?? '').startsWith('【削除？】')).length
for (const delay of [350, 120]) {
  await wizardPaste(page, text)
  await page.keyboard.press('Enter'); await sleep(700)
  await page.keyboard.press('Control+Enter'); await sleep(500)
  if (await T.panel(page)) await page.keyboard.press('Escape')
  await page.locator('.gridwrap').focus()
  const u0 = await ui(page)
  await runPalette(page, '順番に直す', '順番に直すモード'); await sleep(400)
  const trace = []
  let ended = -1
  for (let i = 0; i < 34; i++) {
    const u = await ui(page)
    if (!u.panel) { ended = i; break }
    const before = u.cursorRow
    await page.keyboard.press('1'); await sleep(delay)
    const u2 = await ui(page)
    trace.push(`${before}>${u2.cursorRow}${u2.panel ? '' : '[panel閉]'}`)
  }
  log(`view ${u0.view} delay=${delay}ms: 終了=${ended} 残り=${await flagged()} toast=${((await T.toast(page)) ?? '').slice(0, 80)} | ${trace.join(' ')}`)
}
save(errors); await browser.close()
