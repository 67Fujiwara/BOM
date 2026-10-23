// N3-05 / N3-06 / N3-12 再検証 + 新しいファイル（表題欄・深い見出し・3 シート・2 つの部品表・単位つき数量・2 段見出し・Shift_JIS CSV）
import { launch, fresh, T, makeLog, shot, proj, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t05_wizard_file')
const D = '/home/user/BOM/usertest/newbie/r11/files/'
const files = ['a_title.xlsx', 'a2_title.xlsx', 'b_rich.xlsx', 'c_cover.xlsx', 'd_bom.csv', 'e_offset.xlsx', 'f_holes.xlsx', 'g_titleblock.xlsx', 'h_deep.xlsx', 'i_sheets3.xlsx', 'j_two_boms.xlsx', 'k_values.xlsx', 'm_twoheader.xlsx', 'n_sjis.csv', 'o_sjis_quoted.csv']
for (const f of files) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await page.waitForTimeout(80)
    const foot = (await page.locator('.overlay .foot, .overlay footer').innerText().catch(() => '')).replace(/\s+/g, ' ')
    await page.getByTestId('wizard-file').setInputFiles(D + f); await page.waitForTimeout(700)
    const t1 = await T.toast(page)
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t05_${f.replace(/\W/g, '_')}_preview`)
    await page.keyboard.press('Enter'); await page.waitForTimeout(200)
    const p = await proj(page)
    log(`[${f}] load toast: ${t1} | step7 footer: ${foot.slice(0, 120)}`)
    log(`   preview: ${pv.slice(pv.indexOf('取り込む行'), pv.indexOf('取り込む行') + 420)}`)
    log(`   created ${p.id} rows=${p.rows.length}: ${p.rows.slice(0, 6).map((r) => `{${r.category}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')} toast=${await T.toast(page)}`)
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
