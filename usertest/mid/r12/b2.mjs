// b2: 1 行だけのつもりで RS（案件の相見積先に無い商社）に依頼 → 次の「相見積先すべて」で、選定待ちの見積済の行がまとめて RS に送られ見積中に戻るか
// 引数: pick（依頼パネルで S4 を選ぶ）| quickfix（客先指定品の全社辞退 → Ctrl+. 次の商社 → S4 を選ぶ）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'pick'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
let p = await t.proj()
const quotedBefore = p.rows.filter((r) => r.status === 'quoted' && !r.adoptedSupplierId).map((r) => r.id)
log('sample: quoted (unadopted)', quotedBefore.length, quotedBefore.slice(0, 10).join(','), 'supplierIds', JSON.stringify(p.supplierIds))
await t.press('4'); const d4Before = (await t.viewRows()).filter((id) => quotedBefore.includes(id)).length; log('design 4 quoted rows before', d4Before)
await t.press('1')
let K
if (mode === 'quickfix') {
  K = await h.addRow('R080', '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
} else {
  K = await h.addRow('R080', '特殊コネクタ', 'XYZ-123', 'ラトック', '相見積')
}
log('publish →', await t.publish('1'))
await t.role('purchasing')
if (mode === 'quickfix') {
  // 立花 → ミスミ → 因幡の順に辞退させる
  await h.requestTo(null)
  for (let n = 0; n < 3; n++) {
    p = await t.proj(); const cur = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1)[0]
    if (!cur) break
    await t.press('6'); await t.setCellKey(K, `q.leadDays@${cur.supplierId}`, '取扱なし'); await t.press('Escape')
    p = await t.proj(); if (p.quotes.some((q) => q.rowId === K && !q.stale && q.leadDays !== -1)) continue
    await t.press('4'); await t.goto(K); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); log('Ctrl+.', JSON.stringify(qf?.options))
    if (!qf) break
    await t.press('Enter'); await page.waitForTimeout(100)
    const pr = await t.panel(); const name = /次の商社 (\S+) に依頼/.exec(qf.options[0])?.[1]; const i = pr.options.findIndex((o) => o.endsWith(' ' + name))
    log('choose', name, 'index', i)
    for (let k = 0; k < i; k++) await t.press('ArrowDown')
    await t.press('Enter'); await page.waitForTimeout(1300); log('request →', await t.toast())
  }
  p = await t.proj(); log('K', h.show(p, K))
} else {
  const r = await h.requestTo('S4'); log('request S4 only →', r.msg, JSON.stringify(r.f.map((f) => [f.sup, f.ids])))
}
p = await t.proj(); log('supplierIds now', JSON.stringify(p.supplierIds))
// 設計がもう 1 行足して公開 → 購買がいつもどおり「相見積先すべて」
await t.role('design'); await t.press('1')
const N = await h.addRow(K, '追加端子台', 'UK5N', 'フエニックス', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing')
const r2 = await h.requestTo(null); p = await t.proj()
const reopened = quotedBefore.filter((id) => p.rows.find((r) => r.id === id).status === 'quoting')
log('相見積先すべて →', r2.msg, 'options[0]', r2.options[0])
log('files', JSON.stringify(r2.f.map((f) => [f.sup, f.ids.length])))
log('reopened (見積済 → 見積中)', reopened.length, reopened.slice(0, 8).join(','), h.show(p, reopened[0] ?? quotedBefore[0]))
await t.role('design'); await t.press('4'); const d4After = (await t.viewRows()).filter((id) => quotedBefore.includes(id)).length; log('design 4 quoted rows after', d4After)
check(`B2-1 (${mode}) 1 行のために RS に頼んだあと、いつもの「相見積先すべて」で選定待ちの見積済の行が RS に送られ見積中に戻らない`, reopened.length === 0, `${reopened.length} 行が見積中に戻った / 設計の 4 ${d4Before} → ${d4After}`)
await t.shot('b2-' + mode)
summary(); await t.close()
