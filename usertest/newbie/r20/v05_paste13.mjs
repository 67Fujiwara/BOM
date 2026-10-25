// ラウンド13: ガイドの貼り付け（Excel からコピー）で、数量の見出しの残り・字間空白・グループの 2 段・ページの印
import { launch, fresh, T, makeLog, shot, proj, palette, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v05_paste13')
const cases = [
  ['q 要数', '品名\t型式\tメーカー\t要数\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 所要量', '品名\t型式\tメーカー\t所要量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 使用量', '品名\t型式\tメーカー\t使用量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 必要量', '品名\t型式\tメーカー\t必要量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 員数(台当り)', '品名\t型式\tメーカー\t員数(台当り)\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q QTY/SET', '品名\t型式\tメーカー\tQTY/SET\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q Q\'TY', '品名\t型式\tメーカー\tQ\'TY\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 個', '品名\t型式\tメーカー\t個\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 1台分', '品名\t型式\tメーカー\t1台分\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['q 見出しなし数量列なし', '品名\t型式\tメーカー\t備考\nリレー\tMY4N-D2\tオムロン\t4個使用\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['s 品　名（全角空白）', 'No\t品　名\t型　式\tメーカー\t数　量\n1\tリレー\tMY4N-D2\tオムロン\t4\n2\tタイマ\tH3CR-A8\tオムロン\t12'],
  ['s 品 名（半角空白）', '品 名\t型 式\tメ ー カ\t数 量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['s 部 品 名', '部 品 名\t型 番\tメーカー\t員 数\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t12'],
  ['g グループの 2 段（部品情報｜数量 の下に 旧｜新）', '部品情報\t\t\t数量\t\n品名\t型式\tメーカー\t旧\t新\nリレー\tMY4N-D2\tオムロン\t2\t4\nタイマ\tH3CR-A8\tオムロン\t1\t3'],
  ['g 2 段（数量 の下に 現行｜変更後、ほかは縦に結合＝空）', 'No\t品名\t型式\tメーカー\t数量\t\n\t\t\t\t現行\t変更後\n1\tリレー\tMY4N-D2\tオムロン\t2\t4'],
  ['v 修正前／修正後', '品名\t型式 修正前\t型式 修正後\tメーカー\t数量 修正前\t数量 修正後\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4'],
  ['v 新品番（1 列だけ）', '品名\t新品番\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4'],
  ['v 新品名・新品番', '新品名\t新品番\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4'],
  ['t 中ほどの表題（制御盤A 部品表 2/2 が数量の列）', 'No\t品名\t型式\tメーカー\t数量\n1\tリレー\tMY4N-D2\tオムロン\t4\n制御盤A 部品表\t\t\t\t2/2\n2\tタイマ\tH3CR-A8\tオムロン\t2'],
]
const only = process.argv[2]
for (const [title, text] of cases) {
  if (only && !title.startsWith(only)) continue
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(text); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(200)
  const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ').replace(/^.*?取り込む行/, '取り込む行').replace(/Enter で作成.*$/, '')
  log(`[${title}] ${pv.slice(0, 700)}`)
  await shot(page, 'v05_' + title.split(' ')[0] + '_' + cases.findIndex((c) => c[0] === title))
  await page.keyboard.press('Enter'); await sleep(300)
  const p = await proj(page)
  log(`   rows: ${p.rows.map((r) => `{${r.category}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')} | toast=${await T.toast(page)}`)
  await page.keyboard.press('Control+Enter'); await sleep(200); log(`   Ctrl+Enter -> ${await T.toast(page)}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
}
save(errors); await browser.close()
