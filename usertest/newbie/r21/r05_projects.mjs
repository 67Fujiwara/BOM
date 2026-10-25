// ラウンド15（新人では初めて）: 案件が 2 つ以上になる。ガイドで BOM を 2 つ作る（案件名は Enter で飛ばす）→ 受信箱（Ctrl+K「案件」）→ 見本の案件に戻る → 自分の BOM を探す → リロード
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, palette, store } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r05_projects')
const st = async (tag) => { const u = await ui(page); const p = await proj(page); log(`  [${tag}] project=${p.id}「${p.name}」rows=${p.rows.length} role=${u.role} view=${u.view} panel=${u.panel} cur=${u.cursorRow} | toast: ${(await T.toast(page))?.slice(0, 160)}`) }
async function wiz(text) {
  await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(text); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(250)
  const chk = (await page.getByTestId('wizard').innerText()).replace(/\s+/g, ' ')
  log('  wizard check: ' + chk.slice(0, 300))
  await page.keyboard.press('Enter'); await sleep(350)
}
await fresh(page); await st('start')
await wiz('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2'); await st('BOM 1 作成')
await page.keyboard.press('Control+Enter'); await sleep(250); await st('BOM 1 公開')
await wiz('品名\t型式\tメーカー\t数量\nブレーカ\tNF32-SV\t三菱電機\t1'); await st('BOM 2 作成')
// 受信箱
await palette(page, '案件'); log('  palette 案件: ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 300))
await page.keyboard.press('Escape')
await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150)
log('  inbox: ' + (await page.getByTestId('inbox').innerText()).split('\n').filter(Boolean).join(' / ').slice(0, 900))
await shot(page, 'r05_inbox')
// 見本の案件を選ぶ（一覧の 1 つ目）
await page.keyboard.press('Enter'); await sleep(250); await st('1 つ目を開く')
// 自分の BOM 1 を探す: 受信箱で「新しい」と打つ
await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150)
await page.getByTestId('inbox-input').fill('新しい'); await sleep(100)
log('  inbox 「新しい」: ' + (await page.getByTestId('inbox').innerText()).split('\n').filter(Boolean).join(' / ').slice(0, 600))
await page.getByTestId('inbox-input').fill('リレー'); await sleep(100)
log('  inbox 「リレー」: ' + (await page.getByTestId('inbox').innerText()).split('\n').filter(Boolean).join(' / ').slice(0, 400))
await page.keyboard.press('Enter'); await sleep(200); await st('「リレー」で Enter')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
// 一覧の上から 2 つ目（BOM 1 のつもり）
await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(250); await st('2 つ目を開く')
// Ctrl+P（案件ID の重複の案内に出るキー）
await page.keyboard.press('Control+p'); await sleep(200); log('  Ctrl+P panel=' + (await T.panel(page)) + ' ' + ((await T.panelText(page)) ?? '').slice(0, 120))
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
// リロードでどの案件が開くか
await page.reload(); await page.getByTestId('grid').waitFor(); await sleep(300); await st('reload')
const ws = await store(page); log('  projects: ' + ws.projects.map((p) => `${p.id}「${p.name}」rows=${p.rows.length} rev=${p.submissions.at(-1)?.rev ?? 0}`).join(' / '))
// 購買に切り替えて 2 つ目の BOM（未公開）を開く
await page.getByTestId('role-purchasing').click(); await sleep(200); await st('購買')
await palette(page, '受信箱'); await page.keyboard.press('Enter'); await sleep(150)
log('  inbox(購買): ' + (await page.getByTestId('inbox').innerText()).split('\n').filter(Boolean).join(' / ').slice(0, 900))
save(errors); await browser.close()
