// b4: 採用後の辞退（新しく足した行で）: 指定商社（相見積から切り替えた行・最初から指定の行）、客先指定品（正式見積済）、先行採用の行
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const decline = async (id, sid) => { await t.press('6'); const r = await t.setCellKey(id, `q.leadDays@${sid}`, '取扱なし'); await t.press('Escape'); return r }
const A = await h.addRow('R080', '指定に変える行', 'UK5N', 'フエニックス', '相見積')
const B = await h.addRow(A, '最初から指定', 'UK10N', 'フエニックス', '指定商社', '因幡電機')
const C = await h.addRow(B, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
const D = await h.addRow(C, '先行採用リレー', 'G2R-1 DC12', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('request all →', (await h.requestTo(null)).msg)
await t.press('6')
for (const [sid, pr, ld] of [['S1', 300, 5], ['S2', 280, 6], ['S3', 320, 4]]) await h.q(A, sid, pr, ld)
await h.q(B, 'S1', 500, 5)
await h.q(C, 'S2', 700, 5)
await h.q(D, 'S1', 1200, 5)
let p = await t.proj(); for (const id of [A, B, C, D]) log(h.show(p, id))
// A: 設計が指定商社（立花）に切り替えて公開
await t.role('design'); await t.press('1'); await t.setCellKey(A, 'procurement', '指定商社'); await t.setCellKey(A, 'designated', '立花エレテック')
log('publish change →', await t.publish('1'))
p = await t.proj(); log('A after switch', h.show(p, A))
// D: 見積中のまま先行採用（因幡）→ PM 許可
await t.goto(D); await t.press('Shift+A'); await page.waitForTimeout(80); log('Shift+A panel', JSON.stringify(await t.panel()))
await t.press('1'); await page.waitForTimeout(80); let pn = await t.panel(); log('after 1', JSON.stringify(pn))
for (let g = 0; g < 3 && pn; g++) { if (pn.options?.length && pn.index < 0) { await t.press('1'); await page.waitForTimeout(80) } else { try { await t.promptFill('急ぎ') } catch {} ; await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80) } pn = await t.panel(); log('step', JSON.stringify(pn)) }
log('D early →', await t.toast()); p = await t.proj(); log(h.show(p, D))
await t.role('pm'); const y = await t.yes(D, '先行で'); log('PM y D →', y.toast); p = await t.proj(); log(h.show(p, D))
// 購買: 正式見積を依頼 → C に正式回答
await t.role('purchasing'); log('formal →', await t.requestFormal())
await t.press('8'); const fr = await t.setCellKey(C, 'q.formalPrice@A', '720'); await t.press('Escape'); await t.press('Escape'); log('C formal', fr)
p = await t.proj(); for (const id of [A, B, C, D]) log('before decline', h.show(p, id))
// それぞれ採用商社が辞退
p = await t.proj(); const adoptedA = p.rows.find((r) => r.id === A).adoptedSupplierId
await decline(A, adoptedA ?? 'S2'); await decline(B, 'S1'); await decline(C, 'S2'); await decline(D, 'S1')
p = await t.proj()
for (const id of [A, B, C, D]) log('after decline', h.show(p, id), 'ball', await h.ballOf(id), 'case', await h.caseOf(id))
const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B), rC = p.rows.find((r) => r.id === C), rD = p.rows.find((r) => r.id === D)
check('B4-1 相見積から切り替えた指定商社: 指定先の辞退で見積中・設計のボール（他社の見積で見積済・先行発注判断にならない）', rA.status === 'quoting' && (await h.ballOf(A)) === 'design' && !rA.flags.ltbPending, h.show(p, A))
check('B4-2 最初から指定商社: 指定先の辞退で見積中・設計のボール', rB.status === 'quoting' && (await h.ballOf(B)) === 'design', h.show(p, B))
check('B4-3 客先指定品（正式見積済）: 辞退で見積中・購買のボール・正式単価が消える', rC.status === 'quoting' && (await h.ballOf(C)) === 'purchasing', h.show(p, C))
check('B4-4 先行採用の行: 採用商社の辞退で、ほかの商社の回答待ち（見積中）に戻る（見積済にしない）', rD.status === 'quoting', h.show(p, D))
await t.press('4'); await t.goto(C); await t.press('Home'); log('C status bar', await t.status()); await t.press('Control+.'); await page.waitForTimeout(80); log('C Ctrl+.', JSON.stringify((await t.panel())?.options)); if (await t.panel()) await t.press('Escape')
await t.role('design'); await t.press('4'); const v4 = await t.viewRows(); log('design 4 has A/B', v4.includes(A), v4.includes(B))
summary(); await t.close()
