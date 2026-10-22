import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const dump = async (id) => { const r = await t.row(id); return `maker=${JSON.stringify(r.maker)} model=${JSON.stringify(r.model)} working=${JSON.stringify(r.working)} publishedRev=${r.publishedRev} status=${r.status}` }
log('before:', await dump('R031'))
await t.press('4'); await t.goto('R031'); await t.col('メーカ'); await t.press('Enter'); await t.press('Control+a'); await t.type('オムロン'); await t.press('Enter'); await page.waitForTimeout(50)
log('after view4 edit:', await dump('R031'))
check('DBG 4 要確認での編集が公開済の値に直接書かれない', (await t.row('R031')).maker !== 'オムロン')
// R041（メーカ空）でも
await t.goto('R041'); await t.col('メーカ'); await t.press('Enter'); await t.type('オムロン'); await t.press('Enter'); await page.waitForTimeout(50)
log('R041 after view4 edit:', await dump('R041'))
// view 1 で R009
await t.press('1'); await t.goto('R009'); await t.col('メーカ'); await t.press('Enter'); await t.type('フエニックス'); await t.press('Enter'); await page.waitForTimeout(50)
log('R009 after view1 edit:', await dump('R009'))
// 購買から見える値
await t.role('purchasing'); log('purchasing R031 maker cell:', await t.cell('R031', 'maker'), 'R009:', await t.cell('R009', 'maker'))
log('events:', (await t.proj()).events.slice(-4).map((e) => e.text))
log('ERRORS:', t.errors)
await t.close()
