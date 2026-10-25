// ラウンド15（新人では初めて）: Excel の BOM を「読み込む」つもりで Ctrl+K に「読み込み」「Excel 読み込み」と打ち、「JSON を読み込む」に Excel の表を貼る／xlsx を選ぶ
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, palette, paletteTop } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r06_json_misuse')
await fresh(page)
for (const w of ['読み込み', '読み込む', 'Excel読み込み', 'エクセル 読み込み', 'BOMを読み込む', '部品表 取り込み', 'ファイルを開く', 'インポート', 'Excelから', '開く']) {
  await palette(page, w); log(`  palette 「${w}」 -> ${(await paletteTop(page, 3)).join(' / ')}`); await page.keyboard.press('Escape')
}
const before = await proj(page)
log(`  before: project=${before.id} rows=${before.rows.length}`)
// 「JSON を読み込む」に Excel からコピーした表を貼る
await palette(page, '読み込み')
const items = await page.getByTestId('palette-list').locator('.item').allTextContents()
const i = items.findIndex((t) => t.includes('JSON を読み込む')); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
await page.keyboard.press('Enter'); await sleep(200)
log('  panel: ' + (await T.panelText(page)))
await shot(page, 'r06_import_panel')
const ta = page.locator('.overlay textarea').first()
await ta.fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2'); await sleep(80)
await page.keyboard.press('Control+Enter'); await sleep(250)
log(`  TSV を貼って Ctrl+Enter -> toast: ${await T.toast(page)} | panel=${await T.panel(page)}`)
await shot(page, 'r06_tsv_toast')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
// ファイルを選ぶ: xlsx
await palette(page, 'JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(200)
const fi = page.locator('.overlay input[type=file]')
log('  file input count=' + (await fi.count()) + ' accept=' + (await fi.first().getAttribute('accept').catch(() => '-')))
if (await fi.count()) { await fi.first().setInputFiles('/home/user/BOM/usertest/newbie/r22/files15/b5_change_after_add.xlsx'); await sleep(800) }
log(`  xlsx を選ぶ -> toast: ${(await T.toast(page))?.slice(0, 300)} | panel=${await T.panel(page)} | ${(await T.panelText(page))?.slice(0, 200)}`)
const ta2 = page.locator('.overlay textarea').first(); if (await ta2.count()) log('  textarea after file: ' + JSON.stringify((await ta2.inputValue()).slice(0, 80)))
await page.keyboard.press('Control+Enter'); await sleep(250)
log(`  Ctrl+Enter -> toast: ${(await T.toast(page))?.slice(0, 300)} | panel=${await T.panel(page)}`)
await shot(page, 'r06_xlsx_toast')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
// CSV を選ぶ
const csv = '/home/user/BOM/usertest/newbie/r22/files15/bom.csv'
const fs = await import('node:fs'); fs.writeFileSync(csv, '品名,型式,メーカー,数量\nリレー,MY4N-D2,オムロン,4\n')
await palette(page, 'JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(200)
if (await fi.count()) { await page.locator('.overlay input[type=file]').first().setInputFiles(csv); await sleep(800) }
log(`  csv を選ぶ -> toast: ${(await T.toast(page))?.slice(0, 300)} | panel=${await T.panel(page)}`)
await page.keyboard.press('Control+Enter'); await sleep(250)
log(`  Ctrl+Enter -> toast: ${(await T.toast(page))?.slice(0, 300)} | panel=${await T.panel(page)}`)
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
const after = await proj(page); log(`  after: project=${after.id} rows=${after.rows.length}`)
save(errors); await browser.close()
