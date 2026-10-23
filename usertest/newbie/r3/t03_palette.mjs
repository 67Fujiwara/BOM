// N2-01 / U2-13 / U-01: パレットに新人の言葉を打つ。先頭と Enter の結果
import { launch, fresh, T, makeLog, shot, palette, paletteTop, store, proj, ui, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t03_palette')
const words = {
  design: ['JSON を書き出す', 'JSONを書き出す', 'json', '書き出し', 'エクスポート', '保存', '提出', '公開', '案件を開く', '案件一覧', '納期', 'ログアウト', '購買', 'やり直し', 'ソート', 'フィルタ', '文字を大きく', '隠した', '行を戻す', '削除', '行を消す', '元に戻す', 'ヘルプ', '使い方', 'わからない', '新規', '行を追加', '印刷', 'ダークモード', '暗く', '列', 'ジャンプ', '検索', '問題', '直す', '役割', '設計', '読み込み', 'インポート', 'ファイル', '見積', '採用', 'サンプル', 'リセット', '指摘', '質問', '承認', 'excel', 'エクセル', 'csv', 'コピー', '貼り付け', 'undo', 'redo', 'help', 'save', 'export'],
  purchasing: ['指摘', '指摘を起票', '発行', '見積', '概算見積', '見積依頼', '取り込み', '回答', '正式見積', '発注', '商社', '集約', '期限', '案件設定', 'JSON を書き出す'],
  pm: ['承認', '却下', '決定', '案件設定', '納期', '予算', '重み', '確定', '選定者', 'JSON を書き出す'],
}
for (const role of ['design', 'purchasing', 'pm']) {
  await fresh(page, role)
  for (const w of words[role]) {
    await palette(page, w)
    const top = await paletteTop(page, 3)
    log(`${role} "${w}" -> ${top.length ? top.join(' || ') : '(該当なし)'}`)
    await page.keyboard.press('Escape')
  }
}
// Enter で実際に起きること（危ないものだけ）
const risky = [['design', 'JSON を書き出す'], ['design', '書き出す'], ['design', '出す'], ['purchasing', '指摘'], ['design', '購買'], ['design', '提出'], ['purchasing', '見積']]
for (const [role, w] of risky) {
  await fresh(page, role)
  const p0 = await proj(page)
  const dl = page.waitForEvent('download', { timeout: 2500 }).catch(() => null)
  await palette(page, w); const top = (await paletteTop(page, 1))[0]
  await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  const panel1 = await T.panelText(page)
  await page.keyboard.press('Enter'); await page.waitForTimeout(150)
  const panel2 = await T.panelText(page)
  const d = await dl
  const p1 = await proj(page)
  log(`ENTER×2 ${role} "${w}" top=${top} | panel1=${panel1?.slice(0, 120)} | panel2=${panel2?.slice(0, 120)} | download=${d ? d.suggestedFilename() : 'none'} | toast=${await T.toast(page)} | subs ${p0.submissions.length}->${p1.submissions.length} issuesDraft ${p0.issues.filter((i) => i.status === 'draft').length}->${p1.issues.filter((i) => i.status === 'draft').length}`)
  await shot(page, `t03_enter_${role}_${w.replace(/\W/g, '_')}`)
}
save(errors)
await browser.close()
