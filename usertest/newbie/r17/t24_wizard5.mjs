// 新規 BOM ガイド: ラウンド5 で足したファイル（使用数・メーカー型式・Q'ty・表題欄 2・小計・単位つき・海外 CSV・CSV 表題）
import { launch, fresh, T, makeLog, shot, proj, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t24_wizard5')
const D = '/home/user/BOM/usertest/newbie/r17/files5/'
const files = ['p_shiyousu.xlsx', 'q_makermodel.xlsx', 'r_titleblock2.xlsx', 's_subtotal.xlsx', 'u_units.xlsx', 't_english.csv', 'v_title.csv']
for (const f of files) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await page.waitForTimeout(80)
    await page.getByTestId('wizard-file').setInputFiles(D + f); await page.waitForTimeout(800)
    const t1 = await T.toast(page)
    await page.keyboard.press('Enter'); await page.waitForTimeout(200)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t24_${f.replace(/\W/g, '_')}_preview`)
    await page.keyboard.press('Enter'); await page.waitForTimeout(250)
    const p = await proj(page)
    log(`[${f}] load toast: ${t1}`)
    log(`   preview: ${pv.slice(0, 600)}`)
    log(`   created ${p.id} rows=${p.rows.length}: ${p.rows.slice(0, 9).map((r) => `{${r.ref}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|${r.note}}`).join(' ')} toast=${await T.toast(page)}`)
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
// 貼り付け: 見出し「品名 メーカー型式 Q'ty」、空行と小計を含む
const pastes = {
  makerModel: "品名\tメーカー型式\tメーカー\tQ'ty\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2",
  subtotal: '品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t4\n\t小計\t\t4\n\nタイマ\tH3CR-A8\tオムロン\t2\n合計\t\t\t6',
  shiyousu: '品名\t型式\tメーカ\t使用数\nリレー\tMY4N\tオムロン\t4',
}
for (const [k, v] of Object.entries(pastes)) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1'); await page.waitForTimeout(80)
    await page.getByTestId('wizard-paste').fill(v); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(200)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t24_paste_${k}`)
    await page.keyboard.press('Enter'); await page.waitForTimeout(250)
    const p = await proj(page)
    log(`[paste ${k}] preview: ${pv.slice(0, 500)}`)
    log(`   created rows=${p.rows.length}: ${p.rows.map((r) => `{${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}}`).join(' ')}`)
  } catch (e) { log('EXC', k, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
