// f3b: 商社マスタでミスミを取引不可にしたあと、ミスミが推奨の見積済の行で a / 一括採用 / Shift+A の一覧
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s))
await t.open('design', ws)
log('suppliers', JSON.stringify((await t.ws()).suppliers.map((s) => [s.id, s.name, s.tradable])))
const topS3 = await page.evaluate(async () => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積').filter((r) => sc.scoreRow(p, r, s.ws.suppliers)[0]?.supplierId === 'S3').map((r) => r.id) })
log('quoted rows whose top is (non-tradable) S3', topS3.join(','))
const B = topS3[0]
await t.press('1'); await t.goto(B); await t.press('Shift+A'); await page.waitForTimeout(100); const dlg = (await t.dialog()).slice(0, 300); await t.press('Escape'); log('Shift+A panel', dlg)
await t.goto(B); await t.press('a'); await page.waitForTimeout(80); const ta = await t.toast(); log('a →', ta)
log('bulk →', await t.bulk())
const p = await t.proj(); const s3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.procurement === '相見積').map((r) => r.id)
log('adopted at non-tradable S3', s3.length, s3.join(','))
check('F3B-1 取引不可の商社を a・一括採用で推奨として採用しない', !s3.length, `${ta} / ${s3.join(',')}`)
check('F3B-2 Shift+A の一覧で取引不可の商社に印がある（または出さない）', /取引不可/.test(dlg) || !dlg.includes('ミスミ'), dlg)
await t.shot('f3b')
summary(); await t.close()
