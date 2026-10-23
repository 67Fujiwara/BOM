import { launch, fresh, palette, sleep, panel, dumpErrors } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await palette(page, '新しいBOM'); await sleep(50)
const dump = async (tag) => console.log(tag, await panel(page), JSON.stringify(await page.evaluate(() => ({ t: document.querySelector('[data-testid="panel-wizard"]')?.innerText.slice(0, 300), inputs: [...document.querySelectorAll('[data-testid="panel-wizard"] input, [data-testid="panel-wizard"] textarea')].map((i) => i.dataset.testid + '=' + i.value) }))))
await dump('s0')
await page.getByTestId('wizard-id').fill('P-PROBE'); await page.keyboard.press('Enter'); await dump('s1')
await page.getByTestId('wizard-name').fill('probe'); await page.keyboard.press('Enter'); await dump('s2')
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(30); await dump('s' + (3 + i)) }
dumpErrors(errors, 'probe')
await browser.close()
