// ラウンド14: ガイドのファイル（データ行の結合セル・〃・変更図の削除行・未定の書き方・数式の合計・表題欄の結合・数量の注記）
import fs from 'node:fs'
import { launch, fresh, T, makeLog, shot, proj, palette, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'q01_wizard14')
const D = '/home/user/BOM/usertest/newbie/r23/files14/'
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D)
for (const f of files) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await sleep(80)
    await page.getByTestId('wizard-file').setInputFiles(D + f); await sleep(1500)
    const t1 = await T.toast(page)
    await page.keyboard.press('Enter'); await sleep(200)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `q01_${f.replace(/\W/g, '_')}_preview`)
    log(`[${f}] load toast: ${t1}`)
    log(`   preview: ${pv.slice(0, 1400)}`)
    if (pv === '-') { log('   panel: ' + (await T.panelText(page))); continue }
    await page.keyboard.press('Enter'); await sleep(300)
    const p = await proj(page)
    log(`   created ${p.id} rows=${p.rows.length}: ${p.rows.map((r) => `{${r.category}|${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}|${r.packQty ?? ""}}`).join(' ')}`)
    log(`   toast=${await T.toast(page)} | cursor=${await T.cursor(page)}`)
    log('   header: ' + (await T.header(page)).replace(/\s+/g, ' ').slice(0, 160))
    await page.keyboard.press('Control+Enter'); await sleep(200); log(`   Ctrl+Enter -> ${await T.toast(page)} | panel ${(await T.panelText(page))?.slice(0, 120)}`)
    if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) }
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
