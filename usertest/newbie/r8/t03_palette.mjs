// U3-01 / U2-13 / U-01 / N3-03 / N3-10 再検証 + 新人の言葉 → Enter
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, paletteTop, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t03_palette')
const words = ['JSONを書き出す', 'JSON を書き出す', 'エクスポート', 'export', 'csv', 'ファイル', '案件を開く', '質問', '取り込み', '期限', '暗く', '文字を大きく', '新規', '提出', '読み込み', '直す', '採用', '一括', '選定者', 'やり直し', 'ソート', 'フィルタ', '隠した', '保存', '印刷', 'エクセル', 'わからない', '使い方', 'ダーク', '拡大', '戻す', '取り消し', '削除', '行を追加', '置換', '発行', '承認', '見積', '依頼', '商社', '発注', '入荷', 'Undo', 'help', '設定', '担当', 'ログアウト', '役割', '購買に切り替え', '全部', 'コピー', '貼り付け', '理由', 'キャンセル', '取消']
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  for (const w of words) {
    await palette(page, w)
    const top = await paletteTop(page, 3)
    log(`[${role}] "${w}" -> ${top.length ? top.join(' || ') : '(該当なし)'}`)
    await page.keyboard.press('Escape')
  }
}
// Enter の結果（危ない語）
for (const w of ['採用', '一括', '選定者', '推奨', 'まとめて']) {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030')
  const a0 = (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length
  await palette(page, w); const top = await paletteTop(page, 2)
  await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  const pt = await T.panelText(page)
  log(`ENTER "${w}" top=[${top.join(' || ')}] -> toast=${await T.toast(page)} panel=${pt?.slice(0, 200)} adopted ${a0}->${(await proj(page)).rows.filter((r) => r.adoptedSupplierId).length}`)
  if (pt) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); log(`   Enter again -> toast=${await T.toast(page)} panel=${(await T.panelText(page))?.slice(0, 100)} adopted ->${(await proj(page)).rows.filter((r) => r.adoptedSupplierId).length}`) }
  await shot(page, `t03_enter_${w}`)
}
// 直す
await fresh(page); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('WRONG'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+z'); await sel(page, 'R009')
await palette(page, '直す'); log('直す top', (await paletteTop(page, 3)).join(' || ')); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
log('  直す Enter ->', await T.toast(page), '| panel', (await T.panelText(page))?.slice(0, 200), '| R040 working', JSON.stringify((await row(page, 'R040')).working))
await shot(page, 't03_naosu'); if (await T.panel(page)) await page.keyboard.press('Escape')
for (const w of ['新規', '提出', '読み込み', 'JSONを書き出す', 'エクスポート']) {
  await fresh(page)
  const dl = page.waitForEvent('download', { timeout: 1500 }).catch(() => null)
  await palette(page, w); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  log(`ENTER "${w}" -> toast=${await T.toast(page)} view=${(await ui(page)).view} panel=${(await T.panelText(page))?.slice(0, 160)}`)
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); log(`   Enter again -> toast=${await T.toast(page)} panel=${(await T.panelText(page))?.slice(0, 160)} download=${(await dl)?.suggestedFilename() ?? 'none'}`) }
}
save(errors); await browser.close()
