// ラウンド14: ガイドの貼り付け（Excel からコピー）。結合セルは Excel のコピーでも左上だけに値（下のセルは空）、〃・同上、変更図の削除行、未定の書き方
import { launch, fresh, T, makeLog, shot, proj, palette, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'q02_paste14')
const probs = () => page.evaluate(async () => {
  const find = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const s = (await import(find('/src/model/store.ts'))).useStore.getState()
  const R = await import(find('/src/model/rules.ts'))
  const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId)
  return p.rows.map((r) => `${r.id}:` + R.checkRow(r, s.ws.rules, p).map((x) => `${x.severity[0]}/${x.field}/${x.message.slice(0, 40)}`).join(';')).join(' | ')
})
export const cases = [
  ['m1 メーカーを縦に結合（Excel コピーで下は空）', '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\t\t2\nリレー\tG2R-1\t\t6\nブレーカ\tNF32-SV\t三菱電機\t2'],
  ['m2 品名を縦に結合', '品名\t型式\tメーカー\t数量\n端子台\tXW2B-20G4\tオムロン\t2\n\tXW2B-40G4\tオムロン\t1\n\tXW2B-60G4\tオムロン\t1'],
  ['d1 〃・同上', '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nリレー\tMY2N-D2\t〃\t2\nタイマ\tH3CR-A8\t同上\t1\n〃\tH3CR-A8N\t〃\t1'],
  ['d2 型式に 〃（シリーズ違い）', '品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nリレー\t〃\tオムロン\t2'],
  ['c1 変更図：新の列が空（削除した部品）', '品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\t備考\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4\t変更\nタイマ\tH3Y-2\t\tオムロン\t1\t\t削除\n端子台\t\tXW2B-20G4\tオムロン\t\t2\t追加'],
  ['c2 変更図：変更後だけ書く（変えない行は空）＋削除', '品名\t型式\t変更後型式\tメーカー\t数量\t変更後数量\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4\nタイマ\tH3Y-2\t\tオムロン\t1\t\nヒューズ\tF-1A\t（削除）\t富士\t2\t0'],
  ['c3 変更図：数量（新）だけ 0（削除）', '品名\t型式\tメーカー\t数量（旧）\t数量（新）\nリレー\tMY4N-D2\tオムロン\t2\t4\nタイマ\tH3CR-A8\tオムロン\t1\t0'],
  ['t1 未定の書き方 その 2', '品名\t型式\tメーカー\t数量\n部品1\t未定（10月決定）\tオムロン\t1\n部品2\t要確認\tオムロン\t1\n部品3\t後日連絡\tIDEC\t1\n部品4\tTBD by 10/30\tTBD\t1\n部品5\tN/A\tN/A\t1\n部品6\t決まり次第\tメーカー不問\t1\n部品7\t未定\tオムロン\t1'],
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
  log(`[${title}] ${pv.slice(0, 900)}`)
  await shot(page, 'q02_' + title.split(' ')[0])
  await page.keyboard.press('Enter'); await sleep(300)
  const p = await proj(page)
  log(`   rows: ${p.rows.map((r) => `{${r.category}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')} | toast=${await T.toast(page)}`)
  log(`   problems: ${await probs()}`)
  await page.keyboard.press('Control+Enter'); await sleep(200); log(`   Ctrl+Enter -> ${await T.toast(page)}`)
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
}
save(errors); await browser.close()
