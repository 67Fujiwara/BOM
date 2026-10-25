// o4b: 商社マスタから消えた商社の見積（残っている）が、その後の採用（a／Shift+A／一括）で幽霊の候補にならないか（M20-05 周辺）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
async function importWs(mut) {
  const ws = await t.ws(); mut(ws)
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus(); return t.toast()
}
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
// S1 が最高スコアで採用されている相見積の行（見積済→選定済）。S1 を消す前に 3 行を選ぶ
const sel = p.rows.filter((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && r.procurement === '相見積' && !r.flags.contested)
const [X, Y] = [sel[0].id, sel[1].id]
log('S1 adopted rows', sel.length, 'X', X, 'Y', Y)
log('remove S1 →', await importWs((ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S1') })); p = await t.proj()
log('X', h.show(p, X)); log('Y', h.show(p, Y))
const ghostQ = p.quotes.filter((q) => q.supplierId === 'S1' && !q.stale).length
log('ghost S1 quotes (not stale)', ghostQ, ' project supplierIds', JSON.stringify(p.supplierIds))
check('O4B-1 消えた商社が案件の相見積先（supplierIds）に残らない', !p.supplierIds.includes('S1'), JSON.stringify(p.supplierIds))
// 設計の a（推奨で採用）
await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(150)
p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
log('a on X →', await t.toast(), '|', h.show(p, X).slice(0, 200))
check('O4B-2 a の結果、採用は取引できる商社（マスタにある）になる', rX.adoptedSupplierId && rX.adoptedSupplierId !== 'S1', `adopt=${rX.adoptedSupplierId} toast=${await t.toast()}`)
// Shift+A の候補
await t.goto(Y); await t.press('Shift+A'); await page.waitForTimeout(120); const ap = await t.panel(); log('Shift+A panel', JSON.stringify(ap?.options)); await t.press('Escape'); if (await t.panel()) await t.press('Escape')
check('O4B-3 Shift+A の候補に消えた商社が出ない', !(ap?.options ?? []).some((o) => /S1|因幡|undefined/.test(o)), JSON.stringify(ap?.options))
// 一括採用
log('bulk again →', await t.bulk()); p = await t.proj()
const ghostAdopt = p.rows.filter((r) => r.adoptedSupplierId === 'S1' && !['ordered', 'received'].includes(r.status)).length
check('O4B-4 一括採用のあと、消えた商社を採用した行がない', ghostAdopt === 0, `ghostAdopt=${ghostAdopt}`)
const stuck = p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.supplierId !== 'S1' && q.unitPrice != null && q.leadDays !== -1).length >= 1).map((r) => r.id)
log('quoted のまま残った行（S1 以外に有効な見積あり）', stuck.length, stuck.slice(0, 8).join(','))
check('O4B-5 S1 以外に有効な見積がある行は、一括採用で採用される（幽霊の S1 に邪魔されない）', stuck.length === 0 || stuck.every((id) => { const r = p.rows.find((x) => x.id === id); return r.flags.pmPending || r.flags.contested }), `stuck=${stuck.length}`)
// 新しい行を足して、概算見積を「相見積先すべて」に依頼（案件の相見積先に消えた商社 S1 が残っている）
await t.role('design'); await t.press('1')
const Z = await h.addRow('R075', '追加行Z', 'G3VM-61A9', 'オムロン', '相見積', '', '4'); log('publish Z →', (await t.publish('1')).slice(0, 80))
await t.role('purchasing'); const n0 = t.downloads.length; const rq = await h.requestTo(null).catch((e) => ({ msg: 'ERR ' + e.message, f: [] })); await page.waitForTimeout(1500)
const fz = await h.files(n0); log('rough request →', rq.msg?.slice(0, 160), JSON.stringify(rq.options), JSON.stringify(fz.map((f) => [f.sup, f.ids.length])))
p = await t.proj(); log('Z', h.show(p, Z).slice(0, 220))
check('O4B-7 概算見積の依頼で console error（消えた商社宛の依頼書の作成失敗）が出ない', t.errors.length === 0, JSON.stringify(t.errors).slice(0, 300))
check('O4B-8 Z は依頼された商社（マスタにある 2 社以上）に出る', fz.filter((f) => f.ids.includes(Z)).length >= 2, JSON.stringify(fz.map((f) => [f.sup, f.ids.includes(Z)])))
log('ERRORS', JSON.stringify(t.errors)); check('O4B-6 console error なし', t.errors.length === 0, JSON.stringify(t.errors).slice(0, 300)); summary(); await t.close()
