// ガイド「2 ファイル」で Excel / CSV を読ませる新人
import { launch, fresh, T, makeLog, shot, proj, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t10_file')
const D = '/home/user/BOM/usertest/newbie/r3/files/'
for (const f of ['a_title.xlsx', 'a2_title.xlsx', 'b_rich.xlsx', 'c_cover.xlsx', 'd_bom.csv', 'e_offset.xlsx', 'f_holes.xlsx']) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await page.waitForTimeout(80)
    await page.getByTestId('wizard-file').setInputFiles(D + f); await page.waitForTimeout(600)
    const t1 = await T.toast(page)
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t10_${f.replace(/\W/g, '_')}_preview`)
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const p = await proj(page)
    log(`[${f}] load toast: ${t1}`)
    log(`   preview: ${pv.slice(pv.indexOf('取り込む行'), pv.indexOf('取り込む行') + 400)}`)
    log(`   created ${p.id} rows=${p.rows.length}: ${p.rows.slice(0, 5).map((r) => `{${r.category}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}|${r.note}}`).join(' ')} toast=${await T.toast(page)}`)
  } catch (e) { log('EXC', f, String(e).slice(0, 300)) }
}
// 貼り付けで表題行つき
for (const [k, txt] of Object.entries({ titlePaste: '部品表 第4ライン\n\n品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t4\nタイマ\tH3CR\tオムロン\t2', titlePaste2: '第4ライン 使用部品\n品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t4' })) {
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('1'); await page.waitForTimeout(50); await page.getByTestId('wizard-paste').fill(txt); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80)
  const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const p = await proj(page)
  log(`[${k}] preview: ${pv.slice(pv.indexOf('取り込む行'), pv.indexOf('取り込む行') + 300)}`)
  log(`   rows=${p.rows.length}: ${p.rows.slice(0, 4).map((r) => `{${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}}`).join(' ')}`)
  await shot(page, `t10_${k}`)
}
save(errors)
await browser.close()
