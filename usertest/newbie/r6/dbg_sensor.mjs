import { launch, fresh, T, sel, gotoCol, ui, typeReal, proj, palette } from './lib.mjs'
const { browser, page } = await launch()
const dumpEdit = async (tag) => { const u = await ui(page); console.log(tag, JSON.stringify({ mode: u.mode, cur: u.cursorRow + '/' + u.cursorCol, edit: u.editValue, sort: u.sort, view: u.view }), await T.toast(page)) }
// A: 新規 BOM（1 つずつ入力）の 3 行目
await fresh(page)
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
await page.keyboard.press('Enter'); await page.keyboard.insertText('リレー'); await page.keyboard.press('Enter')
await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80); await page.keyboard.press('Escape')
await dumpEdit('before')
for (const ch of 'Sensor') { if (/[A-Z]/.test(ch)) await page.keyboard.press('Shift+Key' + ch); else await page.keyboard.press(ch); await page.waitForTimeout(80); await dumpEdit('  after ' + ch) }
await page.keyboard.press('Enter'); await page.waitForTimeout(80)
console.log((await proj(page)).rows.map((r) => r.id + ':' + r.name).join(' '))
// B: サンプルのビュー 4 で
await fresh(page); await page.keyboard.press('4'); await page.keyboard.press('ArrowDown'); await gotoCol(page, '部品名'); await dumpEdit('B before')
for (const ch of 'Sensor') { if (/[A-Z]/.test(ch)) await page.keyboard.press('Shift+Key' + ch); else await page.keyboard.press(ch); await page.waitForTimeout(80); await dumpEdit('  after ' + ch) }
await browser.close()
