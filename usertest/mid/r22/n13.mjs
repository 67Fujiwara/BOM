// n13: 商社マスタ・JSON 読み込みの頑健さ（取引停止／商社の削除／壊れた JSON／足りない項目）
//   各ケースで JSON を読み込み、画面が壊れない（console error なし）・知らせが出る・採用の整合を確かめる
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
async function importText(text) {
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(text); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(300)
  const pn = await t.panel(); const info = { panel: pn ? { kind: pn.kind, title: pn.title, options: pn.options?.map((o) => o.slice(0, 50)), error: pn.error } : null, toast: await t.toast() }
  for (let g = 0; g < 3; g++) { const q = await t.panel(); if (!q) break; const i = (q.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await page.keyboard.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus(); info.after = await t.toast(); return info
}
let ws = await t.ws(); const base = JSON.stringify(ws)
// 1) 壊れた JSON
let r = await importText('{"projects": [ {'); log('broken →', JSON.stringify(r).slice(0, 300))
check('N13-1 壊れた JSON は読み込まず知らせる（データは変わらない）', JSON.stringify(await t.ws()) === base, JSON.stringify(r).slice(0, 200))
// 2) 空のオブジェクト
r = await importText('{}'); log('empty →', JSON.stringify(r).slice(0, 300))
check('N13-2 {} は読み込まない（データは変わらない）', JSON.stringify(await t.ws()) === base, JSON.stringify(r).slice(0, 200))
// 3) 配列
r = await importText('[1,2,3]'); log('array →', JSON.stringify(r).slice(0, 300))
check('N13-3 配列は読み込まない', JSON.stringify(await t.ws()) === base, JSON.stringify(r).slice(0, 200))
// 4) 採用中の商社（S1）を商社マスタから削除
ws = await t.ws(); const adoptedS1 = (await t.proj()).rows.filter((x) => x.adoptedSupplierId === 'S1').length
ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S1')
r = await importText(JSON.stringify(ws)); log('S1 removed →', JSON.stringify(r).slice(0, 400))
let p = await t.proj(); const nowS1 = p.rows.filter((x) => x.adoptedSupplierId === 'S1').length
log('adopted S1 before', adoptedS1, 'after', nowS1, 'status sample', JSON.stringify(p.rows.filter((x) => x.adoptedSupplierId === 'S1').slice(0, 2).map((x) => [x.id, x.status])))
check('N13-4 商社マスタから消えた商社を採用したままにしない（採用が外れる、または読み込みを断る）', nowS1 === 0 || /読み込めません|読み込みませんでした|やめました/.test(r.after), `before=${adoptedS1} after=${nowS1} ${JSON.stringify(r.after).slice(0, 200)}`)
// 5) 取引停止にした商社に正式依頼中・見積済の行がある（l5 と同じ）＋ すぐ戻す
await t.press('9'); log('visible rows 9', (await t.viewRows()).length)
// 6) 商社の項目が足りない（name なし）
ws = await t.ws(); if (ws.suppliers[0]) { delete ws.suppliers[0].name; }
r = await importText(JSON.stringify(ws)); log('missing name →', JSON.stringify(r).slice(0, 300))
await page.waitForTimeout(200)
log('grid still renders', await page.getByTestId('grid').isVisible())
check('N13-5 商社の名前が無い JSON でも画面が壊れない', await page.getByTestId('grid').isVisible(), JSON.stringify(r).slice(0, 200))
log('ERRORS', JSON.stringify(t.errors))
check('N13-6 console error なし', t.errors.length === 0, JSON.stringify(t.errors).slice(0, 300))
summary(); await t.close()
