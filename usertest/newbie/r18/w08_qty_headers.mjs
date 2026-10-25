// 数量の列の見出しの書き方（使用個数・手配数量・1台当たり など）と、数量の列が無いときの案内（ガイドの貼り付け）
import { launch, fresh, T, makeLog, shot, proj, palette, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w08_qty_headers')
const heads = ['使用個数', '手配数量', '1台当たり数量', '要数', '総数量', '必要個数', '員数/台', 'ｸﾞﾙｰﾌﾟ数量', '現数量', '新数量', '数量']
for (const h of heads) {
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(`品名\t型式\tメーカー\t${h}\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12`); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(200)
  const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ').replace(/^.*?取り込む行/, '取り込む行').replace(/Enter で作成.*$/, '')
  log(`[${h}] ${pv}`)
  if (h === '使用個数') await shot(page, 'w08_qty_usage_preview')
  await page.keyboard.press('Enter'); await sleep(300)
  const p = await proj(page)
  log(`   rows: ${p.rows.map((r) => `${r.name}/${r.model}/${r.qtyNeeded}${r.unit}`).join(' ')} | toast=${await T.toast(page)}`)
  await page.keyboard.press('Control+Enter'); await sleep(200); log(`   Ctrl+Enter -> ${await T.toast(page)}`)
}
save(errors); await browser.close()
