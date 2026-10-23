// b5: 承認 ON の変更セットで足した行（PM 承認待ち）: 購買の 6・9・1 の見え方、手入力・取り込み・概算依頼・一括採用、承認後 / 却下後
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm')
log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); await t.press('1')
const A = await h.addRow('R080', '承認待ち追加A', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '承認待ち追加B', 'UK5N', 'フエニックス', '指定商社', '因幡電機')
log('publish →', await t.publish('1'))
let p = await t.proj(); log(h.show(p, A), 'pendingRev', p.rows.find((r) => r.id === A).pendingRev); log(h.show(p, B))
await t.role('purchasing')
for (const v of [6, 9, 1, 4]) { await t.press(String(v)); const rows = await t.viewRows(); log(`purch view ${v} has A/B`, rows.includes(A), rows.includes(B), rows.includes(A) ? 'name=' + (await t.cellText(A, 'name')) + ' model=' + (await t.cellText(A, 'model')) + ' status=' + (await t.cellText(A, 'status')) : '') }
await t.press('6'); const in6 = (await t.viewRows()).includes(A)
check('B5-1 購買の 6 に承認待ちの追加行が出ない', !in6)
await t.press('9'); const in9 = (await t.viewRows()).includes(A)
check('B5-2 購買の 9（購買作業）にも承認待ちの追加行の部品名・型式は出ない（承認待ちの変更ありだけ）', !in9 || (await t.cellText(A, 'model')) === '', `in9=${in9} model=${in9 ? await t.cellText(A, 'model') : ''}`)
// 1 すべてで商社の列に入れる
await t.press('1'); let r1 = ''; try { await t.showCol('q.unitPrice@S1'); r1 = await t.setCellKey(A, 'q.unitPrice@S1', '1500'); await t.press('Escape') } catch (e) { r1 = 'ERR ' + e.message.slice(0, 60) }
p = await t.proj(); log('view1 typed →', r1, h.show(p, A))
// 取り込み（因幡の回答に A・B が入っている）
const imp = await h.importAnswers('S1', ['行ID\t型式\t単価\t納期\tMOQ', `${A}\tG2R-1 DC24\t1500\t5\t`, `${B}\tUK5N\t300\t5\t`].join('\n'))
p = await t.proj(); log('import →', imp); log(h.show(p, A)); log(h.show(p, B))
const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
check('B5-3 承認待ちの追加行には見積回答を取り込まない（状態は提出済のまま）', rA.status === 'submitted' && rB.status === 'submitted' && !p.quotes.some((q) => [A, B].includes(q.rowId) && q.unitPrice != null), `${rA.status}/${rB.status}`)
// 概算依頼
const rq = await h.requestTo(null); log('request →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
// PM の判断
await t.role('pm'); await t.press('7'); log('PM 7 has A', (await t.viewRows()).includes(A), 'case', await h.caseOf(A))
const rej = process.argv[2] === 'reject'
if (rej) { await t.goto(A); await t.press('Shift+Y'); await page.waitForTimeout(80); if (await t.panel()) { await t.promptFill('不要'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } }
else { log('y →', (await t.yes(A, '承認')).toast) }
p = await t.proj(); log('after PM', h.show(p, A)); log(h.show(p, B))
if (rej) check('B5-4 却下で追加行は下書きに戻り、取り込んだ見積が残らない', p.rows.find((r) => r.id === A).status === 'draft' && !p.quotes.some((q) => [A, B].includes(q.rowId) && !q.stale && q.unitPrice != null), h.show(p, A))
else {
  await t.role('purchasing'); const rq2 = await h.requestTo(null); p = await t.proj(); log('request after approve →', rq2.msg, JSON.stringify(rq2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])), h.show(p, A), h.show(p, B))
  check('B5-4 承認後は依頼でき、A は 3 社・B は因幡だけに依頼', rq2.f.filter((f) => f.ids.includes(A)).length >= 2 && rq2.f.filter((f) => f.ids.includes(B)).length === 1, '')
}
summary(); await t.close()
