import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
// ファイル名（ASCII vs 日本語）
const names = []
page.on('download', (d) => names.push(d.suggestedFilename()))
await page.evaluate(() => { for (const n of ['abc.xlsx', 'P-2026-041_第3ライン 搬送制御盤.xlsx']) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'])); a.download = n; a.click() } })
await page.waitForTimeout(500); log('download names (probe):', names)
// Ctrl+Shift+C / Ctrl+Shift+Z のキー
await t.goto('R020')
await t.press('Control+Shift+C'); await page.waitForTimeout(300); log('Ctrl+Shift+C →', await t.toast())
const clip = await page.evaluate(() => navigator.clipboard.readText()); log('clipboard head:', clip.split('\n')[0].slice(0, 80))
await t.showCol('orderQty'); await t.setCellKey('R020', 'orderQty', '9'); await t.press('Control+z'); await page.waitForTimeout(50); log('undo →', await t.toast(), (await t.row('R020')).orderQty)
await t.press('Control+Shift+Z'); await page.waitForTimeout(50); log('Ctrl+Shift+Z →', await t.toast(), (await t.row('R020')).orderQty)
await t.press('Control+z'); await page.waitForTimeout(50); await t.press('Control+y'); await page.waitForTimeout(50); log('Ctrl+Y →', await t.toast(), (await t.row('R020')).orderQty)
// 設計: R031 メーカ編集が効くか
await t.role('design'); await t.press('4'); await t.setCell('R031', 'メーカ', 'オムロン'); log('R031 working:', JSON.stringify((await t.row('R031')).working), 'cursor:', await t.cursor())
await t.press('1'); await t.setCell('R031', 'メーカ', 'IDEC'); log('R031 working (view1):', JSON.stringify((await t.row('R031')).working))
// S5 相当の公開がなぜ止まるか
await t.open('design')
await t.setCell('R005', '型式', 'MY4N-D2 DC12')
await t.setCell('R001', '型式', 'FX5U-32MT/ES')
await t.setCell('R006', '必要数', '18')
await t.setCell('R013', '型式', 's8vk-g12024')
await t.setCell('R007', '代替可否', '客先承認要')
await t.setCell('R007', '型式', 'H3CR-A8 AC24')
await t.goto('R010'); await t.press('Shift+Delete')
await t.goto('R011'); await t.press('r'); await page.waitForTimeout(50); await t.press('Control+a'); await t.type('CLIPFIX 35-5'); await t.press('Enter')
await t.press('Control+Enter'); await page.waitForTimeout(100); log('dlg:', (await page.locator('[role=dialog]').textContent().catch(() => '')).slice(0, 40)); await t.press('2'); await page.waitForTimeout(300)
log('status bar:', await t.status())
log('ERRORS:', t.errors)
await t.close()
