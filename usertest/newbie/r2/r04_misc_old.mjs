// R04: N-23, U-01, U-03, U-05, U-13, U-16, U-17, U-20, N-35 再確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, palette, paletteTop, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r04_misc_old')
try {
  await fresh(page)
  // N-23
  await page.keyboard.press('Control+p'); await page.keyboard.type('存在しない'); await page.keyboard.press('Enter')
  log('N-23 inbox no match Enter: panel', await T.panel(page), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
  // U-01 palette words
  const words = ['ヘルプ', 'help', 'undo', 'save', 'やり直し', '印刷', 'エクセル', '新規', '終了', '保存', '戻る', '提出', '削除', '取り消し', 'ダウンロード', '書き出し', 'JSON を書き出す', 'Excelを出力', '案件を開く', '案件一覧', '見積', '見積依頼', '採用', 'R30', 'r30 採用', 'R030 採用', '指摘', '納期', '予算', '役割', '購買', 'ログアウト', 'コピー', 'ルール', '設定', '公開', '発行', '送る', '出す', 'わからない', '使い方', 'リセット', '初期化', 'ショートカット', 'キー', '列', '隠す', '並び替え', 'ソート', '絞り込み', '検索', 'フィルタ', 'ダーク', '文字を大きく', '重み', '商社', '確定', '承認', '却下']
  for (const w of words) {
    await palette(page, w)
    const top = await paletteTop(page, 3)
    log(`U-01 "${w}" ->`, top.length ? top.map((t) => t.slice(0, 40)).join(' | ') : '(none) ' + (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' ').slice(0, 60))
    await page.keyboard.press('Escape')
  }
  // U-03 読み取り専用列で文字
  await sel(page, 'R020'); await gotoCol(page, 'ID'); await clearToast(page); await page.keyboard.press('z')
  log('U-03 z on ID col:', await T.toast(page), 'mode', await T.mode(page))
  await gotoCol(page, '状態'); await clearToast(page); await page.keyboard.press('b')
  log('U-03 b on 状態 col:', await T.toast(page))
  // U-05 toast size
  const ts = await page.evaluate(() => { const t = document.querySelector('[data-testid=toast-float]'); if (!t) return null; const cs = getComputedStyle(t); return { fs: cs.fontSize, pos: cs.position, bottom: cs.bottom } })
  log('U-05 toast-float style', JSON.stringify(ts))
  // U-16 Shift+A 範囲外
  await sel(page, 'R020'); await page.keyboard.press('Shift+A'); await page.keyboard.press('9')
  log('U-16 Shift+A 9:', await T.toast(page), 'panel', await T.panel(page))
  await page.keyboard.press('Escape')
  // U-17 決定パネルの表示（PM, R013）
  await setRole(page, 'pm'); await page.keyboard.press('7'); await page.keyboard.press('ArrowDown')
  log('U-17 PM view7 cursor', await T.cursor(page), 'hints', await T.hints(page))
  await page.keyboard.press('Enter')
  log('U-17 decision panel:', await T.panelText(page))
  await shot(page, 'r04_decision_panel')
  await page.keyboard.press('z'); log('U-17 z in decision panel:', await T.toast(page))
  await page.keyboard.press('Escape')
  // U-20 hints per role
  await page.keyboard.press('1')
  for (const [role, id] of [['design', 'R020'], ['design', 'R076'], ['purchasing', 'R020'], ['purchasing', 'R076'], ['pm', 'R020'], ['pm', 'R013']]) {
    await setRole(page, role); await page.keyboard.press('1'); await sel(page, id)
    log(`U-20 ${role} ${id} hints:`, await T.hints(page))
  }
  // U-17 指摘アクション
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R016'); await page.keyboard.press(' '); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  log('U-17 issue action panel:', await T.panelText(page))
  await shot(page, 'r04_issue_actions')
  await page.keyboard.press('Escape')
  // N-35 実キー
  await clearToast(page); await sel(page, 'R002')
  await page.keyboard.press('Control+Shift+C'); await page.waitForTimeout(300)
  log('Ctrl+Shift+C real:', await T.toast(page))
  await clearToast(page)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  await page.waitForTimeout(300)
  log('N-35 Ctrl+Shift+c (key c):', await T.toast(page))
} catch (e) { log('EXC', String(e).slice(0, 400)) }
save(errors)
await browser.close()
