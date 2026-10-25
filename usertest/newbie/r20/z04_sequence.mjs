// 順番に直すモード: 各問題で「飛ばして次の問題へ」を選び、R022（購買の提案つきの指摘）でも先へ進めるか / あとで の文と公開
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z04_sequence')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 300) ?? ''} | toast: ${await T.toast(page)}`) }
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(200)
const seen = []
for (let i = 0; i < 14; i++) {
  const u = await ui(page); await st('step ' + i)
  seen.push(u.cursorRow)
  if (u.cursorRow === 'R022') await shot(page, 'z04_R022')
  const txt = (await T.panelText(page)) ?? ''
  const m = /(\d) 飛ばして次の問題へ/.exec(txt)
  if (!m) { log('  no skip option'); break }
  await page.keyboard.press(m[1]); await sleep(200)
}
log('order', seen.join(' → '))
await page.keyboard.press('Escape'); await sleep(100)
log('== あとで を選ぶ → 通知 → Ctrl+Enter')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Delete'); await sleep(80)
await page.keyboard.press('Control+.'); await sleep(150); await st('Ctrl+.')
const t = (await T.panelText(page)) ?? ''; const m2 = /(\d) [^0-9]*あとで/.exec(t)
if (m2) { await page.keyboard.press(m2[1]); await sleep(150); await st('あとで') }
await page.keyboard.press('Control+Enter'); await sleep(200); await st('Ctrl+Enter')
save(errors); await browser.close()
