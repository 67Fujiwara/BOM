// m7: 正式見積の依頼の確認の件数（U18-02 の修正「依頼と同じ数え方」）
//   一括採用 → 正式依頼 → 設計が A の必要日（前倒し）だけ変える（再発行対象）、B の必要数 +50%（再発行・再見積要）、C を作業中、D を支給品に
//   → 購買「正式見積を依頼」: 確認の「対象 n 行」と、依頼した行数が同じ。A は再発行され、B・C・D は出ない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal 1 →', await t.requestFormal())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && r.status === 'formalRequested' && r.procurement === '相見積' && !r.needDateFixed && r.qtyNeeded >= 4)
const [A, B, C, D] = fr.slice(0, 4).map((r) => r.id); const qB = fr[1].qtyNeeded
log('A B C D', A, B, C, D)
await t.role('design'); await t.press('1'); await t.showCol('needOffset', 'procurement')
log('A needOffset →', await t.setCellKey(A, 'needOffset', '-3')); log('B qty →', await t.setCellKey(B, 'qtyNeeded', String(Math.ceil(qB * 1.5)))); log('D 支給品 →', await t.setCellKey(D, 'procurement', '支給品'))
log('publish →', await t.publish('1'))
log('C name (作業中) →', await t.setCellKey(C, 'name', 'WIP'))
p = await t.proj(); for (const id of [A, B, C, D]) log('before', h.show(p, id), p.rows.find((r) => r.id === id).status)
await t.role('purchasing'); await t.press('8')
const n0 = t.downloads.length
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(120); const pn = await t.panel(); log('confirm', pn?.title)
let msg = ''
if (pn) { await page.keyboard.press('2'); await page.waitForTimeout(1500); msg = await t.toast() } else msg = await t.toast()
log('result', msg)
const f = await h.files(n0); const ids = f.flatMap((x) => x.ids); log('files', JSON.stringify(f.map((x) => [x.sup, x.ids])))
const nConfirm = Number((pn?.title ?? '').match(/対象 (\d+) 行/)?.[1] ?? -1)
check('M7-1 確認の「対象 n 行」と、依頼書に出た行数が同じ', nConfirm === new Set(ids).size, `confirm=${nConfirm} sent=${new Set(ids).size} ${pn?.title ?? msg}`)
check('M7-2 A（必要日だけ変えた再発行対象）が再発行され、B（再見積要）・C（作業中）・D（支給品）は出ない', ids.includes(A) && ![B, C, D].some((x) => ids.includes(x)), JSON.stringify(ids))
check('M7-3 確認または結果に、除外した再見積要の行数が出る', /再見積要 1 行/.test((pn?.title ?? '') + msg), (pn?.title ?? '') + ' / ' + msg)
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
