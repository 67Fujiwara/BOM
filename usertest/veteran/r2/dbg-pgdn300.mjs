import { launch, fresh, cursor, sleep, palette } from './lib.mjs'
const { browser, page } = await launch()
const cats = ['制御', '電源', '端子', '配線', '盤', '表示', 'センサ', '']
const lines = ['分類\t品名\t形式\tメーカー\t員数']
for (let i = 1; i <= 300; i++) lines.push([cats[i % 8], `部品${i}`, `M${i}`, 'オムロン', '1'].join('\t'))
await fresh(page)
await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-3'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('1'); await page.getByTestId('wizard-paste').fill(lines.join('\n')); await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter'); await sleep(300)
await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
const t = [await cursor(page)]
const cr = () => page.evaluate(async () => (await import('/src/model/store.ts')).useStore.getState().cursorRow); const items = await page.evaluate(async () => { const s = (await import('/src/model/store.ts')).useStore.getState(); const vm = (await import('/src/model/selectors.ts')).buildViewModel(s); return vm.items.filter((i) => i.kind !== 'detail').map((i) => i.key) }); console.log(items.length, items.slice(0, 25).join(','), items.indexOf('g:配線')); for (let i = 0; i < 4; i++) { await page.keyboard.press('PageDown'); t.push(await cursor(page) + '(' + await cr() + ')') }
await page.keyboard.press('j'); t.push('j:' + await cursor(page))
for (let i = 0; i < 2; i++) { await page.keyboard.press('PageDown'); t.push(await cursor(page)) }
console.log(t.join(' | '))
console.log(await page.evaluate(async () => { const m = await import('/src/model/store.ts'); const s = m.useStore.getState(); return { cursorRow: s.cursorRow, view: s.view, collapsed: s.collapsed } }))
await browser.close()
