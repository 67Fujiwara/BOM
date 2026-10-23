// 迷った新人が Ctrl+K に打つ言葉
import { launch, fresh, makeLog, palette, paletteTop, setRole, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y14_palette_words')
const words = { design: ['提出', '公開', 'submit', '取り消し', '戻す', 'undo', '削除', '行を消す', '行追加', '追加', '保存', 'エクセル', 'excel', '印刷', '検索', '探す', '置換', '置き換え', '代替', '型番変更', '理由', 'ヘルプ', '使い方', 'ショートカット', 'あとで', '次の問題', '直す', 'チェック', '指摘', '返信', '採用', '商社', 'ダーク', '列', '隠す', 'teishutsu', 'kokai', 'sakujo'],
  purchasing: ['見積', '見積依頼', '依頼', '取り込み', '取込', '単価', '正式', '発注', '入荷', '指摘', '起票', '辞退', '先行発注', '集約', '商社追加', 'mitsumori', 'hacchu'],
  pm: ['承認', '却下', '決定', 'ok', 'yes', '差戻し', '納期', '予算', '確定', 'shonin'] }
for (const [role, list] of Object.entries(words)) {
  await fresh(page, role)
  for (const w of list) { await palette(page, w); const top = await paletteTop(page, 3); log(`${role} 「${w}」 -> ${top.length ? top.map((t) => t.slice(0, 60)).join(' / ') : '（0 件）'}`); await page.keyboard.press('Escape') }
}
save(errors); await browser.close()
