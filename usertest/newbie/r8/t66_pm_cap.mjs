// ラウンド8: PM の e（特急・分納の上限）ダイアログで、新人が金額を打つ
import { launch, fresh, T, makeLog, shot, ui, typeReal, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t66_pm_cap')
const dump = async (tag) => { const d = await page.evaluate(() => { const o = document.querySelector('.overlay'); if (!o) return null; return { text: o.innerText.replace(/\s+/g, ' ').slice(0, 300), inputs: [...o.querySelectorAll('input,textarea')].map((e) => ({ ph: e.placeholder, v: e.value, focused: e === document.activeElement, label: e.closest('label')?.innerText?.slice(0, 30) })) } }); log(`  [${tag}]`, JSON.stringify(d), '| toast', await T.toast(page)) }
await fresh(page, 'pm'); await sleep(150)
await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press('e'); await sleep(150); await dump('e opened'); await shot(page, 't66_cap_dialog')
await typeReal(page, '50000', 30); await dump('typed 50000')
await page.keyboard.press('Enter'); await sleep(150); await dump('Enter')
await page.keyboard.press('Tab'); await sleep(50); await typeReal(page, '50000', 30); await dump('Tab + 50000')
await page.keyboard.press('Enter'); await sleep(150); await dump('Enter2')
const p = await proj(page); log('  decisions', JSON.stringify((p.decisions ?? []).map((d) => [d.kind, d.reason, JSON.stringify(d.payload ?? {}).slice(0, 80)])))
save(errors); await browser.close()
