import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, palette } from '../r8/rerun7/rerun6/lib.mjs'
const N = 40
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
const nCopy = Math.ceil(N * 1.9), nNew = Math.ceil(N * 0.45)
for (let k = 1; k <= nCopy + nNew + N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= nCopy ? `OLD-${k}` : k <= nCopy + nNew ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
await wizardCreate(page, 'P-SEQ', lines.join('\n'))
await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
await page.keyboard.press('Alt+/'); await sleep(200)
await page.keyboard.type('部品10'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
const rowsText = async () => (await page.locator('[data-testid="grid"]').innerText()).split('\n').filter((l) => /^R\d{3}/.test(l)).map((l) => l.slice(0, 4))
console.log('visible before', (await rowsText()).join(','))
await palette(page, '順番に直すモード'); await sleep(400)
for (let i = 0; i < 12; i++) { if (!(await panel(page))) break; await page.keyboard.press('1'); await sleep(80) }
console.log('cursor', await page.getByTestId('cursor').textContent())
console.log('visible after', (await rowsText()).join(','))
console.log('filterbar', await page.locator('input[placeholder*="絞り込み"], [data-testid*="filter"]').first().inputValue().catch(() => 'n/a'))
await browser.close()
