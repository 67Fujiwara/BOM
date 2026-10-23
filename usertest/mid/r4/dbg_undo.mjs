import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); log(await t.setCellKey('R030', 'note', 'U05テスト'))
await page.waitForTimeout(1000)
log('hist before reload', await page.evaluate(() => (sessionStorage.getItem('bom-pro.history') ?? '').slice(0, 300)))
log('user', await page.evaluate(() => sessionStorage.getItem('bom-pro.user')))
log('undo keys', await t.S('return Object.keys(st.undo).map(k => k + ":" + st.undo[k].length)'))
await t.reload(); await page.waitForTimeout(500)
log('hist after reload', await page.evaluate(() => (sessionStorage.getItem('bom-pro.history') ?? '').slice(0, 300)))
log('undo keys after', await t.S('return Object.keys(st.undo).map(k => k + ":" + st.undo[k].length)'), await t.S('return st.ws.user'))
await t.close()
