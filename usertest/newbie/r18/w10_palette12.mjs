// 迷ったら Ctrl+K: ラウンド12 の新人の言葉（ダイアログ・取り込み・やり直し）
import { launch, fresh, T, makeLog, palette, paletteTop, sleep, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w10_palette12')
const words = { design: ['変更番号', 'Tab', '選び直し', 'やり直し', '元に戻す', '取り消し', '順番', '順番に直す', 'Excel', '出力', '印刷', 'CSV', 'ファイル', '読み込み', '取り込み', '新規', '行削除', '削除', 'コピー', '保存', '旧型式', '置き換え', 'kakunin', 'hensyu', 'shusei'], purchasing: ['見積依頼', '依頼書', '回答', '正式', '採用', '取引不可', '商社'], pm: ['承認待ち', '決裁', '特急', '分納', '次点へ'] }
for (const [role, list] of Object.entries(words)) {
  await fresh(page, role)
  for (const w of list) { await palette(page, w); const top = await paletteTop(page, 2); log(`${role} 「${w}」 -> ${top.join(' / ') || (await page.getByTestId('palette-list').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80)}`); await page.keyboard.press('Escape'); await sleep(30) }
}
save(errors); await browser.close()
