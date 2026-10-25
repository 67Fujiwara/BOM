// ラウンド16: 2 段の見出しで下の段が「現行｜変更」の変更図（r13 から読めていた書き方）をガイドで貼る/読む → 知らせのとおり「4 要確認」で問題の行（現行 0 個）を Shift+Delete → Ctrl+Enter。購買で何に見えるか
import { launch, T, makeLog, sleep, shot, proj, setRole, sel } from './lib.mjs'
import { wizardPaste, wizardFile, rowsText, probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r17_genkou_follow16')
const TXT = ['品名\t型式\t\tメーカー\t数量\t', '\t現行\t変更\t\t現行\t変更', 'リレー\tMY2N\tMY4N-D2\tオムロン\t2\t4', 'タイマ\tH3CR-A8\tH3CR-A8\tオムロン\t1\t1'].join('\n')
for (const [tag, open] of [['paste', () => wizardPaste(page, TXT)], ['xlsx', async () => (await wizardFile(page, '/home/user/BOM/usertest/newbie/r20/files13/m3c_tier_genkou_henkou.xlsx')).pv]]) {
  log(`== ${tag}`)
  const pv = await open(); log('  preview: ' + pv.slice(0, 400))
  await page.keyboard.press('Enter'); await sleep(350)
  let p = await proj(page); log(`  created rows=${p.rows.length}: ${rowsText(p)}`); log('  problems: ' + (await probs(page)))
  await sel(page, 'R001'); await page.keyboard.press('Shift+Delete'); await sleep(200)
  log('  Shift+Delete -> ' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
  if (await T.panel(page)) { log('   panel: ' + (await T.panelText(page))?.slice(0, 150)); await page.keyboard.press('Enter'); await sleep(200) }
  await page.keyboard.press('Control+Enter'); await sleep(300); log('  Ctrl+Enter -> ' + (await T.toast(page)) + ' panel=' + (await T.panel(page)))
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
  await setRole(page, 'purchasing'); await sleep(200)
  p = await proj(page); log(`  購買: ${p.rows.map((r) => `${r.id}:${r.name}|${r.model}|${r.qtyNeeded}:${r.status}`).join(' ')}`)
  await shot(page, 'r17_' + tag)
}
save(errors); await browser.close()
