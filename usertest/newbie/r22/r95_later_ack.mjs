// ラウンド22: 【削除？】の行で「2 あとで」「Alt+x（確認済み）」「Shift+→」を押すと何が起きるか。そのまま公開できてしまわないか
import { launch, T, makeLog, ui, sleep, proj, sel, gotoCol } from './lib.mjs'
import { wizardPaste, probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r95_later_ack')
const mk = () => {
  const rows = ['リレー\tMY2N\tMY4N-D2\tオムロン\t2\t']
  for (let i = 1; i <= 3; i++) rows.push(`部品${i}\tP-${i}0\tP-${i}0\tオムロン\t1\t`)
  for (let i = 1; i <= 2; i++) rows.push(`未記入${i}\tE-${i}0\t\tオムロン\t1\t`)
  return ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...rows].join('\n')
}
for (const how of ['Alt+x', 'Shift+ArrowRight', 'quickfix2']) {
  await wizardPaste(page, mk())
  await page.keyboard.press('Enter'); await sleep(500)
  // 1 すべて のビューで備考の列へ
  await page.keyboard.press('Alt+1'); await sleep(200)
  await sel(page, 'R005'); await gotoCol(page, '備考')
  log(`== ${how}: cursor ${await T.cursor(page)} problems: ${(await probs(page)).slice(0, 120)}`)
  if (how === 'quickfix2') { await page.keyboard.press('Control+.'); await sleep(250); log('  panel: ' + ((await T.panelText(page)) ?? '').slice(0, 300)); await page.keyboard.press('2'); await sleep(250) }
  else { await page.keyboard.press(how); await sleep(250) }
  log('  toast: ' + (await T.toast(page)))
  const p = await proj(page); log('  R005 ackRules=' + JSON.stringify(p.rows.find((r) => r.id === 'R005').ackRules) + ' note=' + p.rows.find((r) => r.id === 'R005').note)
  log('  problems after: ' + (await probs(page)).slice(0, 200))
  await page.keyboard.press('Control+Enter'); await sleep(400)
  log('  Ctrl+Enter: ' + (await T.toast(page)) + ' | panel ' + ((await T.panelText(page)) ?? '-').slice(0, 120))
  const p2 = await proj(page); log('  statuses: ' + p2.rows.map((r) => `${r.id}:${r.status}`).join(' '))
}
save(errors); await browser.close()
