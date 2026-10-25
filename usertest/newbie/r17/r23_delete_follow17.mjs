// ラウンド17: 全行を書き写した変更図（変えない行も変更後の欄に同じ値）で、削除する部品は変更後の欄を空にした。削除が 5 行中 2 行。
// 新人はガイドで貼り、知らせを読んで Enter → Ctrl+Enter → 購買で何行に見えるか。比べ: 削除する行の新の型式に「削除」と書いた表
import { launch, T, makeLog, sleep, shot, proj, setRole } from './lib.mjs'
import { wizardPaste, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r23_delete_follow17')
const H = '品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）'
const A = [H, 'リレー\tMY2N\tMY4N-D2\tオムロン\t2\t2', 'タイマ\tH3CR-A8\tH3CR-A8\tオムロン\t1\t1', 'ブレーカ\tNF32-SV\t\t三菱電機\t1\t', '端子台\tXW2B-20G4\tXW2B-20G4\tオムロン\t4\t4', 'ランプ\tL-1\t\tIDEC\t1\t'].join('\n')
async function run(tag, text) {
  log('== ' + tag)
  const pv = await wizardPaste(page, text)
  log('  preview: ' + pv.slice(0, 700))
  await shot(page, 'r23_' + tag.split(' ')[0] + '_preview')
  await page.keyboard.press('Enter'); await sleep(350)
  let p = await proj(page); log(`  created rows=${p.rows.length}: ${rowsText(p)}`); log('  toast: ' + (await T.toast(page)))
  await page.keyboard.press('Control+Enter'); await sleep(300); log('  Ctrl+Enter -> ' + (await T.toast(page)))
  await setRole(page, 'purchasing'); await sleep(250)
  p = await proj(page); log(`  購買: rows=${p.rows.length} ${p.rows.map((r) => `${r.id}:${r.name}:${r.model}:${r.qtyNeeded}:${r.status}`).join(' ')}`)
  await shot(page, 'r23_' + tag.split(' ')[0] + '_purch')
}
await run('A 削除 2 行は変更後の欄を空に（5 行中 2 行）', A)
await run('B 削除 1 行だけ（5 行中 1 行。8 割）', A.replace('ランプ\tL-1\t\tIDEC\t1\t', 'ランプ\tL-1\tL-1\tIDEC\t1\t1'))
await run('C 削除の行の新の型式に「削除」と書く', A.replace('ブレーカ\tNF32-SV\t\t三菱電機\t1\t', 'ブレーカ\tNF32-SV\t削除\t三菱電機\t1\t').replace('ランプ\tL-1\t\tIDEC\t1\t', 'ランプ\tL-1\t削除\tIDEC\t1\t'))
save(errors); await browser.close()
