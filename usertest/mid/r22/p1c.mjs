// p1c: 見積中の新しい行（相見積／指定商社／客先指定品）に S1 へ依頼したあと、S1 をマスタから消す（quoteTargets・requestRevs・指定先が S1 を指す）→ 固まらず他の商社に頼める／復元したとき依頼書の Rev が続く
//   usage: node p1c.mjs [remove|stop]
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { importWs, errs, scanViews, stuck, lintXlsx } from './plib.mjs'
const mode = process.argv[2] ?? 'remove'; const tag = 'P1C-' + mode
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const N1 = await h.addRow('R075', '見積中行N1', 'G3VM-61A1', 'オムロン', '相見積', '', '5')
const N2 = await h.addRow(N1, '見積中行N2', 'G3VM-61A2', 'オムロン', '相見積', '', '6')
const N3 = await h.addRow(N2, '指定商社行N3', 'MY2N-D2', 'オムロン', '指定商社', 'S1', '3')
const N4 = await h.addRow(N3, '客先指定行N4', 'MY4N-D2', 'オムロン', '客先指定品', 'オムロン / 客先承認 KS-9', '3')
log('rows', N1, N2, N3, N4); log('publish →', (await t.publish('1')).slice(-40))
await t.role('purchasing')
const r1 = await h.requestTo('S1'); log('rough to S1 →', r1.msg.slice(0, 100), JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((i) => [N1, N2, N3, N4].includes(i))])))
let p = await t.proj(); log('requestRevs', JSON.stringify(p.requestRevs)); for (const id of [N1, N2, N3, N4]) log(' ', id, h.show(p, id).slice(0, 120), 'targets', JSON.stringify(p.rows.find((r) => r.id === id).quoteTargets ?? null))
// S1 を消す／停止する
log(mode, await importWs(t, (ws) => { ws.suppliers = mode === 'remove' ? ws.suppliers.filter((s) => s.id !== 'S1') : ws.suppliers.map((s) => (s.id === 'S1' ? { ...s, tradable: false } : s)) }))
p = await t.proj(); for (const id of [N1, N2, N3, N4]) log(' after', id, h.show(p, id).slice(0, 160), 'targets', JSON.stringify(p.rows.find((r) => r.id === id).quoteTargets ?? null), 'ball', await h.ballOf(id))
let sk = await stuck(t); check(`${tag}-1 S1 を消して/停止してもボールの無い行・ビューに載らない行がない`, sk.length === 0, sk.slice(0, 5))
// 指定商社 N3 の指定先 S1：設計に「マスタにありません／取引停止」が出る → 指定先を S2 に直す
await t.role('design'); await t.press('4'); const in4 = (await t.viewRows()).includes(N3); log('N3 in design 4', in4, 'ball', await h.ballOf(N3))
const prN3 = await page.evaluate(async (id) => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return m.checkRow(p.rows.find((x) => x.id === id), s.ws.rules, p).map((x) => x.message) }, N3)
log('N3 problems', JSON.stringify(prN3))
if (mode === 'remove') check(`${tag}-2 指定先が消えた N3 は設計に「マスタにありません」と出て、設計の 4 に載る`, in4 && prN3.some((m) => /マスタにありません/.test(m)), `in4=${in4} ${JSON.stringify(prN3)}`)
else { await page.keyboard.press('Escape'); const sb = await t.status().catch(() => ''); log('status bar N3:', (sb ?? '').slice(0, 160)); check(`${tag}-2 指定先が取引停止の N3 は設計のボール（指定先を変える）`, (await h.ballOf(N3)) === 'design', `ball=${await h.ballOf(N3)}`) }
await t.press('1'); await t.showCol('designated'); log('N3 designated → S2', (await t.setCellKey(N3, 'designated', 'S2')).slice(0, 50)); log('publish →', (await t.publish('1')).slice(-40))
await t.role('purchasing')
const r2 = await h.requestTo(null); log('rough to all →', r2.msg.slice(0, 120), JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((i) => [N1, N2, N3, N4].includes(i))])))
check(`${tag}-3 S1 を除く相見積先（S2・S3）に、S1 にしか頼んでいなかった N1・N2 の依頼書が出る`, r2.f.some((f) => f.ids.includes(N1) && f.ids.includes(N2)) && !r2.f.some((f) => /因幡/.test(f.sup)), JSON.stringify(r2.f.map((f) => [f.sup, f.ids.length])))
check(`${tag}-4 指定先を S2 に直した N3 は S2 宛に出る（S1 宛でない）`, r2.f.some((f) => /立花/.test(f.sup) && f.ids.includes(N3)) && !r2.f.some((f) => /因幡/.test(f.sup) && f.ids.includes(N3)), JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((i) => i === N3)])))
log('N4 (客先指定品) in files', JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(N4)])))
check(`${tag}-5 客先指定品 N4 は消えた/停止の S1 宛に出ない`, !r2.f.some((f) => /因幡/.test(f.sup) && f.ids.includes(N4)), JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(N4)])))
p = await t.proj(); for (const id of [N1, N2, N3, N4]) log(' now', id, h.show(p, id).slice(0, 180))
// 回答を入れて見積済になるか（N1・N2：S2・S3 が回答すれば S1 を待たない）
await t.press('6'); for (const id of [N1, N2]) for (const sid of ['S2', 'S3']) { await t.setCellKey(id, `q.unitPrice@${sid}`, '200'); await t.press('Escape'); await t.setCellKey(id, `q.leadDays@${sid}`, '6'); await t.press('Escape') }
p = await t.proj(); const q1 = p.rows.find((r) => r.id === N1), q2 = p.rows.find((r) => r.id === N2)
log('N1', h.show(p, N1).slice(0, 200)); check(`${tag}-6 S2・S3 が回答すれば N1・N2 は見積済（消えた/停止の S1 の回答を待たない）`, q1.status === 'quoted' && q2.status === 'quoted', `${q1.status} ${q2.status} ${await t.cellText(N1, 'status')}`)
// 復元（remove のとき）：同じ ID で S1 をマスタに戻す → 依頼書の Rev が続く・文字がおかしくならない
if (mode === 'remove') {
  log('restore S1 →', await importWs(t, (ws) => { if (!ws.suppliers.some((s) => s.id === 'S1')) ws.suppliers.unshift({ id: 'S1', name: '因幡電機', color: '#2b6cb0', order: 0, kind: '商社', tradable: true, avl: true, handledMakers: ['オムロン'], onTimeRate: null, defectRate: null }) }))
  await t.role('design'); await t.press('1'); const N5 = await h.addRow(N4, '復元後行N5', 'G3VM-61A9', 'オムロン', '相見積', '', '7'); log('publish →', (await t.publish('1')).slice(-30))
  await t.role('purchasing'); const n0 = t.downloads.length; const r3 = await h.requestTo('S1'); log('rough to S1 again →', r3.msg.slice(0, 100), JSON.stringify(r3.f.map((f) => [f.sup, f.ids.length])))
  await page.waitForTimeout(600)
  const names = t.downloads.slice(n0).map((d) => d.suggested); log('files', names.join(' | '))
  check(`${tag}-7 S1 を戻して頼むと依頼書ができる（例外なし）。依頼No に S1`, r3.f.some((f) => /因幡/.test(f.sup) && f.ids.includes(N5)), JSON.stringify(r3.f.map((f) => [f.sup, f.ids.length])))
  const lb = await lintXlsx(t.downloads.slice(n0)); check(`${tag}-8 依頼書の文字に undefined が出ない`, lb.length === 0, lb.slice(0, 3))
}
const bad = await scanViews(t, ['purchasing', 'design', 'pm'], [4, 5, 6, 9]); check(`${tag}-9 画面の文字に undefined が出ない`, bad.length === 0, bad.slice(0, 4))
sk = await stuck(t); check(`${tag}-10 固まる行がない`, sk.length === 0, sk.slice(0, 4))
errs(t, tag + '-11'); summary(); await t.close()
