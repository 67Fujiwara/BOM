// 1024×700（ライト・ダーク）でダイアログが画面に収まるか、下の案内（Enter・Esc）が見えるか
import { launch, fresh, setRole, T, makeLog, sel, gotoCol, ui, typeReal, sleep, shot, palette } from './lib.mjs'
const { log, save } = makeLog('x13_layout_dialogs')
const allErr = []
for (const scheme of ['light', 'dark']) {
  const { browser, page, errors } = await launch({ viewport: { width: 1024, height: 700 }, colorScheme: scheme })
  const measure = async (name) => {
    const m = await page.evaluate(() => { const d = document.querySelector('.overlay .dialog'); if (!d) return null; const r = d.getBoundingClientRect(); const foot = d.querySelector('.foot, footer, .keys'); const fr = foot?.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), scrollH: d.scrollHeight, clientH: d.clientHeight, overflowY: getComputedStyle(d).overflowY, foot: fr ? [Math.round(fr.top), Math.round(fr.bottom)] : null, vh: innerHeight } })
    log(`[${scheme}] ${name}: ${JSON.stringify(m)}`); await shot(page, `x13_${scheme}_${name}`)
  }
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+1'); await sel(page, 'R030'); await page.keyboard.press('Alt+Shift+I'); await sleep(150); await measure('issue'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await fresh(page, 'pm'); await page.keyboard.press('Enter'); await sleep(150); await measure('decision'); await page.keyboard.press('e'); await sleep(150); await measure('decision_e'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await fresh(page); await page.keyboard.press('F1'); await sleep(150); await measure('help'); await page.keyboard.press('Escape')
  await palette(page, ''); await sleep(100); await measure('palette'); await page.keyboard.press('Escape')
  await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await sleep(150); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter'); await page.keyboard.press('1'); await sleep(80)
  await page.getByTestId('wizard-paste').fill(Array.from({ length: 30 }, (_, i) => `リレー${i}\tMY4N-${i}\tオムロン\t${i + 1}`).join('\n')); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await sleep(200); await measure('wizard_preview')
  await page.keyboard.press('Escape'); await sleep(80); if (await T.panel(page)) await page.keyboard.press('Escape')
  await fresh(page); await sel(page, 'R005'); await page.keyboard.press('Alt+Shift+A'); await sleep(150); await measure('adopt'); await page.keyboard.press('Escape')
  await fresh(page); await sel(page, 'R030'); await page.keyboard.press('Alt+r'); await sleep(150); await measure('replace'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await runSettings(page); await measure('settings')
  allErr.push(...errors); await browser.close()
}
async function runSettings(page) { await fresh(page); await palette(page, '案件設定'); await page.keyboard.press('Enter'); await sleep(200) }
save(allErr)
