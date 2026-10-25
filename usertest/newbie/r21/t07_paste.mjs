// ガイドの貼り付け: 見出しなし 2・3・4 列、表題行、英語見出し、Ctrl+V の直後の Enter、U-07（列の対応）
import { launch, fresh, T, makeLog, shot, proj, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t07_paste')
const cases = {
  noHeader2: 'MY4N\t4\nH3CR-A8\t2',
  noHeader3: 'リレー\tMY4N\t4\nタイマ\tH3CR-A8\t2',
  noHeader3b: 'リレー\tMY4N\tオムロン\nタイマ\tH3CR-A8\tオムロン',
  noHeader4: 'リレー\tMY4N\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2',
  modelFirst: 'MY4N\tリレー\tオムロン\t4\nH3CR-A8\tタイマ\tオムロン\t2',
  qtyFirst: '4\tリレー\tMY4N\tオムロン\n2\tタイマ\tH3CR-A8\tオムロン',
  titlePaste: '部品表 第4ライン\n\n品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t4\nタイマ\tH3CR\tオムロン\t2',
  titleBlock: '品名\t第4ライン 制御盤\t図番\tE-1234\n\nNo\t品名\t形式\tメーカー\t員数\n1\tリレー\tMY4N\tオムロン\t4',
  english: 'Part Name\tPart No\tMfr\tQty\nRelay\tMY4N\tOmron\t4',
  englishB: 'Description\tManufacturer Part Number\tManufacturer\tQuantity\tDesignator\nRelay\tMY4N\tOmron\t4\tK1',
  refFirst: '記号\t品名\t形式\tメーカー\t員数\nK1\tリレー\tMY4N\tオムロン\t4',
  qtyUnit: '品名\t形式\tメーカー\t員数\t単位\n電線\tKIV 1.25\t住友電装\t20\tm\nリレー\tMY4N\tオムロン\t4\t個\nバンド\tT18R\tヘラマン\t1\t袋',
  fullwidth: '品名\t形式\tメーカー\t員数\nリレー\tＭＹ４Ｎ\tオムロン\t４',
}
for (const [k, txt] of Object.entries(cases)) {
  try {
    await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('1'); await page.waitForTimeout(80)
    // 新人: Ctrl+V で貼る（クリップボード経由）
    await page.evaluate((t) => navigator.clipboard.writeText(t), txt)
    await page.keyboard.press('Control+v'); await page.waitForTimeout(100)
    const ta = await page.getByTestId('wizard-paste').inputValue()
    const foot = (await page.locator('.overlay').innerText()).replace(/\s+/g, ' ').slice(-120)
    // Excel の習慣で Enter → 改行になる。もう一度 Enter → まだ改行。Ctrl+Enter で次へ
    await page.keyboard.press('Enter'); await page.waitForTimeout(60)
    const stepAfterEnter = (await T.panelText(page))?.includes('取り込む行') ? 'preview' : 'still paste'
    await page.keyboard.press('Control+Enter'); await page.waitForTimeout(120)
    const pv = (await page.getByTestId('wizard-preview').innerText().catch(() => '-')).replace(/\s+/g, ' ')
    await shot(page, `t07_${k}`)
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const p = await proj(page)
    log(`[${k}] pasted ok=${ta === txt} | Enter in textarea -> ${stepAfterEnter} | foot: ${foot}`)
    log(`   preview: ${pv.slice(pv.indexOf('取り込む行'), pv.indexOf('取り込む行') + 360)}`)
    log(`   rows=${p.rows.length}: ${p.rows.slice(0, 4).map((r) => `{${r.category}|${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}|ref=${r.ref}|${r.note}}`).join(' ')}`)
  } catch (e) { log('EXC', k, String(e).slice(0, 300)) }
}
save(errors); await browser.close()
