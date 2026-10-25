// 迷った新人が Ctrl+K に打つ言葉（追加）。上位 3 件が目的の操作か
import { launch, fresh, makeLog, palette, paletteTop, setRole, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z08_palette_more')
const words = { design: ['やり直し', '元に戻す', '新しいBOM', '新規', 'BOM作成', '取込', 'インポート', '読み込み', '貼り付け', '問題', 'エラー', '警告', '確認済み', '順番', '一括', '並び替え', 'ソート', '絞り込み', 'フィルタ', '入力モード', 'F2', '役割', 'ログイン', '購買に切替', '数量', '必要日', '指定商社', 'メーカ指定', '列を表示', '旧型式'],
  purchasing: ['見積回答', '回答', '在庫', '納期', '有効期限', '期限切れ', '発注数', '取消', '再見積', '据え置き', '代替提案', '最安', '推奨', '採用', 'MOQ', '追加費用', '分納', '特急', 'ロット', '入荷日'],
  pm: ['上限', '次点', '再交渉', '受入', '保留', '差戻', '案件設定', '重み', '影響', '先行'] }
for (const [role, list] of Object.entries(words)) {
  await fresh(page, role)
  for (const w of list) { await palette(page, w); const top = await paletteTop(page, 3); log(`${role} 「${w}」 -> ${top.length ? top.map((t) => t.slice(0, 50)).join(' / ') : '（0 件）'}`); await page.keyboard.press('Escape') }
}
save(errors); await browser.close()
