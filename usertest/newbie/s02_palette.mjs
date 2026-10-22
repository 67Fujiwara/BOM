// S02: ? と Ctrl+K に頼る新人（約15人）。日本語でいろいろ打つ
import { launch, fresh, T, makeLog, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, finding, save } = makeLog('s02_palette')
try {
  await fresh(page)
  await page.keyboard.press('?')
  log('help open:', await T.panel(page))
  const helpText = await page.getByTestId('help').textContent()
  for (const k of ['公開', '指摘を起票', 'Ctrl+Enter', '要決定', 'Backspace', 'セルを空にする', '行を隠す']) log('help has', k, helpText.includes(k))
  await shot(page, 's02_help')
  await page.keyboard.press('?')
  log('help closed by ?:', await T.panel(page))
  await page.keyboard.press('?')
  await page.keyboard.press('Escape')
  log('help closed by Esc:', await T.panel(page))
  // Ctrl+K で日本語を打つ
  const queries = ['保存', '削除', '戻る', '終了', '印刷', '提出', '採用', '指摘', '公開', 'ヘルプ', '設定', 'ダーク', '新規', '新しい', '見積', '発注', '入荷', 'エクセル', 'Excel', 'excel', '出力', 'コピー', '貼り付け', '検索', '絞り込み', 'ジャンプ', 'R999', 'R01', 'r1', '35', 'abc', '役割', 'ログイン', 'やり直し', '元に戻す', '履歴', '行を追加', '追加', '閉じる', 'サンプル', '案件', '受信箱', '承認', '却下', '?', 'help', 'undo', 'save', '並び替え', '表示', '列', '重み', 'ルール', '', ' ']
  const results = {}
  for (const q of queries) {
    await page.keyboard.press('Control+k')
    await page.getByTestId('palette-input').fill(q)
    await page.waitForTimeout(30)
    const items = await page.getByTestId('palette-list').locator('.item').allTextContents()
    results[q] = items.slice(0, 5).map((s) => s.replace(/\s+/g, ' ').slice(0, 60))
    log(`palette[${q}] n=${items.length}:`, results[q].join(' || '))
    await page.keyboard.press('Escape')
  }
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('印刷')
  await shot(page, 's02_palette_print')
  await page.keyboard.press('Escape')
  // Ctrl+K を2回（トグル）
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Control+k')
  log('Ctrl+K twice -> panel', await T.panel(page))
  // 「該当なし」で Enter
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('印刷')
  await page.keyboard.press('Enter')
  log('Enter on no result: panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // パレットで Ctrl+Z を打つ（入力欄の undo?）
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('公開')
  await page.keyboard.press('Control+z')
  log('Ctrl+Z in palette: input', await page.getByTestId('palette-input').inputValue(), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // パレット内で j/k/1/a を打つ → ナビ操作が誤爆しないか
  await page.keyboard.press('Control+k')
  await page.keyboard.type('j4a')
  log('typed j4a in palette: view', await T.view(page), 'input', await page.getByTestId('palette-input').inputValue(), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // 「R035 採用」を Enter → トースト
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('R035 採用')
  await page.keyboard.press('Enter')
  log('R035 採用:', await T.toast(page))
  // 次は「R036 採用 因幡」のような商社指定
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('R036 採用 x')
  log('R036 採用 x items:', (await page.getByTestId('palette-list').locator('.item').allTextContents()).slice(0, 3))
  await page.keyboard.press('Escape')
  // 最近使った操作が上に来るか
  await page.keyboard.press('Control+k')
  const first = await page.getByTestId('palette-list').locator('.item').first().textContent()
  log('palette empty first item (recent?):', first.slice(0, 80))
  await page.keyboard.press('Escape')
  // Ctrl+P (受信箱) 
  await page.keyboard.press('Control+p')
  log('Ctrl+P panel:', await T.panel(page))
  await shot(page, 's02_inbox')
  await page.getByTestId('inbox-input').fill('存在しない')
  await page.keyboard.press('Enter')
  log('inbox Enter on no match: panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
} catch (e) { log('EXC', String(e)) }
log('console/page errors:', errors)
save(errors)
await browser.close()
