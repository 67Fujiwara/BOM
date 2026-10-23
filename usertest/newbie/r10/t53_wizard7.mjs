// ラウンド7: ガイドのファイル（UTF-16「Unicode テキスト」・数式・エラー値・合計の書き方・「計」で始まる部品）
import { launch, fresh, T, makeLog, shot, proj, palette, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t53_wizard7')
const D = '/home/user/BOM/usertest/newbie/r10/files7/'
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['w_utf16le.txt', 'w_utf16be.txt', 'w_utf16le_as.csv', 'x_formula.xlsx', 'y_errors.xlsx', 'z_totals.xlsx', 'z_kei_parts.xlsx']
for (const f of files) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await sleep(80)
    await page.getByTestId('wizard-file').setInputFiles(D + f); await sleep(800)
    const t1 = await T.toast(page)
    await page.keyboard.press('Enter'); await sleep(200)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t53_${f.replace(/\W/g, '_')}_preview`)
    log(`[${f}] load toast: ${t1}`)
    log(`   preview: ${pv.slice(0, 900)}`)
    if (pv === '-') { log('   panel: ' + (await T.panelText(page))); continue }
    await page.keyboard.press('Enter'); await sleep(300)
    const p = await proj(page)
    log(`   created ${p.id} rows=${p.rows.length}: ${p.rows.map((r) => `{${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')}`)
    log(`   toast=${await T.toast(page)} | cursor=${await T.cursor(page)}`)
    await page.keyboard.press('Control+Enter'); await sleep(200); log(`   Ctrl+Enter -> ${await T.toast(page)} | panel ${(await T.panelText(page))?.slice(0, 120)}`)
    if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
