// y1c: 客先指定品の依頼先が辞退した直後のボール・4・設計の a・ヘッダー
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); await t.goto('R080'); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type('客先指定スイッチ'); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
let p = await t.proj(); const c = p.rows.find((r) => r.name === '客先指定スイッチ').id
await t.showCol('designated', 'procurement')
await t.setCellKey(c, 'model', 'WTP5001'); await t.setCellKey(c, 'maker', 'パナソニック'); await t.setCellKey(c, 'procurement', '客先指定品'); await t.setCellKey(c, 'designated', '客先承認 KS-9'); await t.setCellKey(c, 'qtyNeeded', '4'); await t.setCellKey(c, 'ref', 'SW9')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rough →', await t.requestRough())
await t.press('6'); await t.setCellKey(c, 'q.leadDays@S2', '取扱なし'); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); const r = p.rows.find((x) => x.id === c); log('after decline', c, r.status, 'ball', await t.cellText(c, 'ball'), 'status cell', await t.cellText(c, 'status'))
await t.press('4'); const pu4 = (await t.viewRows()).includes(c); log('purch 4 has c', pu4, 'lamps', await t.lamps())
await t.press('9'); await t.goto(c); log('purch status bar', (await t.status()).slice(0, 160))
await t.role('design'); await t.press('4'); const de4 = (await t.viewRows()).includes(c); log('design 4 has c', de4, 'lamps', await t.lamps())
await t.goto(c); await t.press('Home'); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast())
await t.press('Shift+A'); await page.waitForTimeout(80); log('design Shift+A →', JSON.stringify(await t.panel())?.slice(0, 100), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.shot('y1c-declined-ball-design')
check('Y1c-1 客先指定品の依頼先が辞退した行は、次の依頼をする購買のボール（購買の 4）になる', (await t.cellText(c, 'ball')) === '購買' || pu4, `ball=${await t.cellText(c, 'ball')} purch4=${pu4} design4=${de4}`)
summary(); await t.close()
