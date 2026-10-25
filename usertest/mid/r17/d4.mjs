// d4: 承認 ON の変更セット（PM 承認待ち）: 購買の 2・5・1・6・9・Ctrl+G での見え方、既存行の調達区分の切り替え（承認待ち → 却下）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
// 先に承認 OFF で指定商社の行を作り、立花の回答で選定済にしておく
const S = await h.addRow('R080', '指定の既存行', 'G2R-1 DC24', 'オムロン', '指定商社', '立花エレテック')
log('publish S →', await t.publish('1'))
await t.role('purchasing'); log('request →', (await h.requestTo(null)).msg)
await t.press('6'); await h.q(S, 'S2', 1500, 5); await t.press('Escape')
let p = await t.proj(); log('S before', h.show(p, S))
await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); await t.press('1')
const A = await h.addRow(S, '承認待ち追加A', 'G2R-2 DC24', 'オムロン', '相見積')
await t.setCellKey(S, 'procurement', '相見積')
log('publish →', await t.publish('1'))
p = await t.proj(); log('A', h.show(p, A)); log('S pending', h.show(p, S), 'pendingApproval', JSON.stringify(p.rows.find((r) => r.id === S).pendingApproval))
check('D4-1 承認待ちの間は、既存行 S（指定商社・選定済）の採用・状態は変わらない（購買には承認待ちの変更ありだけ）', p.rows.find((r) => r.id === S).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === S).status === 'selected', h.show(p, S))
await t.role('purchasing')
const seen = {}
for (const v of [1, 2, 5, 6, 9]) { await t.press(String(v)); const rows = await t.viewRows(); seen[v] = rows.includes(A); log(`purch view ${v} has A`, rows.includes(A), rows.includes(A) ? 'name=' + (await t.cellText(A, 'name')) + ' model=' + (await t.cellText(A, 'model')) : '') }
check('D4-2 承認待ちの追加行は購買の 2（購買提出用）にも出ない（§5 承認されるまで購買には「承認待ちの変更あり」だけ）', !seen[2], JSON.stringify(seen))
check('D4-3 承認待ちの追加行は購買の 5（変更あり）にも部品名・型式が出ない', !seen[5], JSON.stringify(seen))
await t.press('1'); await t.goto(A); const cur = await t.curRow(); log('Ctrl+G A in view 1 → cursorRow', cur, 'toast', await t.toast())
log('header', (await t.header()).slice(0, 200))
// PM が却下
await t.role('pm'); await t.press('7'); log('PM 7 has S/A', JSON.stringify((await t.viewRows()).filter((x) => [S, A].includes(x))))
for (const id of [S]) { await t.goto(id); await t.press('Shift+Y'); await page.waitForTimeout(80); if (await t.panel()) { await t.promptFill('切り替え不要'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } }
p = await t.proj(); log('S after reject', h.show(p, S), 'working', JSON.stringify(p.rows.find((r) => r.id === S).working)); log('A after reject', h.show(p, A))
check('D4-4 却下後、S は指定商社・立花で選定済のまま（承認待ちの間に採用が外れていない）', p.rows.find((r) => r.id === S).procurement === '指定商社' && p.rows.find((r) => r.id === S).adoptedSupplierId === 'S2', h.show(p, S))
summary(); await t.close()
