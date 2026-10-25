// ラウンド8: N7-01（残り）・N7-02・N7-04・U7-01・U7-02 の再検証と、編集中の「?ヘルプ」
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep, palette, paletteTop } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t60_reverify')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | hints: ${await T.hints(page)} | toast: ${await T.toast(page)}`) }
const side = async () => (await page.getByTestId('side').innerText()).replace(/\s+/g, ' ').slice(0, 160)
const brief = (r) => r && `${r.id}{st=${r.status} ord=${r.ordered} rcv=${r.received} hid=${r.hidden} sup=${r.adoptedSupplierId} name=${r.name} w=${JSON.stringify(r.working ?? null)}}`
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }

await step('N7-02 A: 起動（行なし）→ サイド → ↓ → サイド → F1 ヘルプのビュー行 → パレット「要確認」', async () => {
  await fresh(page); await sleep(200)
  log('  side(no row):', await side())
  await page.keyboard.press('ArrowDown'); await sleep(100); await state('↓')
  log('  side(R001 部品名):', await side())
  await page.keyboard.press('F1'); await sleep(150)
  const help = (await page.getByTestId('help').innerText()).replace(/\s+/g, ' ')
  log('  help view rows:', (help.match(/ビュー: 要確認\s*\S+/) ?? [''])[0], '|', (help.match(/次の問題へ\s*\S+\s*\S+/) ?? [''])[0], '|', (help.match(/絞り込み検索にフォーカス\s*\S+/) ?? [''])[0], '|', (help.match(/承認 \/ 受入 \/ 許可\s*\S+/) ?? [''])[0])
  await shot(page, 't60_A_help_on_name')
  await page.keyboard.press('Escape'); await sleep(80)
  await palette(page, '要確認'); log('  palette 要確認:', await paletteTop(page, 2)); await page.keyboard.press('Escape')
  await palette(page, '絞り込み'); log('  palette 絞り込み:', await paletteTop(page, 3)); await page.keyboard.press('Escape')
  await palette(page, '並び替え'); log('  palette 並び替え:', await paletteTop(page, 2)); await page.keyboard.press('Escape')
})
await step('N7-02 B: 起動（行なし）→ 6（サイドは「6」）→ サイドの表示 → 4 → Enter', async () => {
  await fresh(page); await sleep(200)
  await page.keyboard.press('6'); await sleep(120); await state('6')
  log('  side after 6:', await side())
  await page.keyboard.press('4'); await sleep(100); await state('4')
  await page.keyboard.press('Enter'); await sleep(100); await state('Enter')
  log('  R001', brief(await row(page, 'R001')))
  await shot(page, 't60_B_6_4')
})
await step('N7-01 残り A: 購買 R013 部品名で romaji「sumi」（済）→ 案内の例 → そのとおり押す', async () => {
  await fresh(page, 'purchasing'); await sel(page, 'R013'); await gotoCol(page, '部品名'); log('  before', brief(await row(page, 'R013')))
  await typeReal(page, 'sumi', 60); await sleep(100); await state('sumi')
  const t = await T.toast(page); const m = /例: (Alt\+[^）)]+)/.exec(t ?? '')
  if (m) { const k = m[1].replace(/Alt\+Shift\+(\w)/, 'Alt+Shift+Key$1').replace(/Alt\+([a-z])$/, (_, c) => `Alt+Key${c.toUpperCase()}`); log('  pressing', m[1], '->', k); await page.keyboard.press(k); await sleep(150); await state('as hinted') }
  log('  after', brief(await row(page, 'R013'))); await shot(page, 't60_N701_sumi')
})
await step('N7-01 残り B: 設計 R005 単価（自動計算）で「mada」（まだ）→ 案内の例 → そのとおり押す', async () => {
  await fresh(page); await sel(page, 'R005'); await gotoCol(page, '単価'); log('  before', brief(await row(page, 'R005')))
  await typeReal(page, 'mada', 60); await sleep(100); await state('mada')
  const t = await T.toast(page); const m = /例: (Alt\+[^）)]+)/.exec(t ?? '')
  if (m) { const k = m[1].replace(/Alt\+([a-z])$/, (_, c) => `Alt+Key${c.toUpperCase()}`); log('  pressing', m[1]); await page.keyboard.press(k); await sleep(150); await state('as hinted') }
  log('  after', brief(await row(page, 'R005')))
})
await step('N7-01 残り C: 購買 R013 備考で「memo」→ 例', async () => {
  await fresh(page, 'purchasing'); await sel(page, 'R013'); await gotoCol(page, '備考')
  await typeReal(page, 'memo', 60); await sleep(100); await state('memo')
  await typeReal(page, 'Hai', 60); await sleep(100); await state('Hai')
})
await step('U7-01: 購買 9 の部品名で 6・8・4、PM 7 の部品名で 6・1・7', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  for (const d of ['6', '8', '4', '9']) { await page.keyboard.press(d); await sleep(100); const u = await ui(page); log(`   purch ${d}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode}`) }
  log('  side(purch 9):', await side())
  await fresh(page, 'pm'); await sleep(150)
  for (const d of ['6', '1', '7']) { await page.keyboard.press(d); await sleep(100); const u = await ui(page); log(`   pm ${d}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode}`) }
  log('  side(pm 7):', await side())
})
await step('U7-02: PM 決定パネル Enter 連打', async () => {
  await fresh(page, 'pm'); await sleep(150)
  await page.keyboard.press('Enter'); await sleep(100); log('  panel', (await T.panelText(page))?.slice(0, 200))
  await page.keyboard.press('Enter'); await sleep(100); await state('Enter2')
  await page.keyboard.press('Escape')
})
await step('編集中の「?ヘルプ」: 設計 R030 型式 → Enter（編集）→ ステータスバー → ? → F1', async () => {
  await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式')
  await page.keyboard.press('Enter'); await sleep(80); await state('Enter (edit)')
  await page.keyboard.press('?'); await sleep(80); await state('?')
  await page.keyboard.press('F1'); await sleep(150); await state('F1'); log('  panel', await T.panel(page))
  await page.keyboard.press('Escape'); await sleep(80); await state('Esc')
  await page.keyboard.press('Escape'); await sleep(80)
  // 直接打って ? → Enter
  await typeReal(page, 'MY4N', 40); await page.keyboard.press('?'); await sleep(60); await state('MY4N?'); await page.keyboard.press('Enter'); await sleep(80)
  log('  R030', brief(await row(page, 'R030')))
})
save(errors); await browser.close()
