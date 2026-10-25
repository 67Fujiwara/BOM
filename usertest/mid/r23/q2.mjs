// q2: 承認 ON。却下／承認した変更セットの「決定」の行・指摘が、役割ごとの Excel（変更点・チェック結果）にどう出るか。
//   購買には、承認待ち・却下の変更セットに関する行（Rev の行・決定の行・指摘）を出さない（§5）。
//   usage: node q2.mjs <order>   order: rej | appr | rej-appr | appr-rej | chain
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { errs } from './plib.mjs'
const order = process.argv[2] ?? 'rej'; const tag = 'Q2-' + order
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const cand = await c.setup(); const A = cand[0].id, B = cand[1].id
await t.role('design'); await t.press('1')
const D = await h.addRow(A, '追加行Q2', 'G3VM-61A1', 'オムロン', '相見積', '', '6')
const qa = cand[0].qtyNeeded
log('A', A, 'B', B, 'D', D)
async function chgDump(role) { await t.role(role); const ex = await c.excel(0); return { chg: ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows), chk: ex.filter((s) => s.sh === 'チェック結果').flatMap((s) => s.rows), bom: ex.filter((s) => s.sh !== '変更点' && s.sh !== 'チェック結果') } }
async function pubQtyAndAdd(q) { await t.role('design'); await t.press('1'); await t.setCellKey(A, 'qtyNeeded', String(q)); return t.publish('1') }
// Rev1: A の必要数 +、D の追加（未公開）を同時に公開
log('publish 1 →', (await pubQtyAndAdd(qa + 3)).slice(-60))
let p = await t.proj(); log('subs', c.subs(p))
const decide = async (key, id) => { await t.role('pm'); await t.press('7'); const r = key === 'y' ? await t.yes(id, '承認') : await t.decide(id, 'Shift+Y', '却下の理由XYZ'); return r.toast }
const leakWords = ['却下の理由XYZ', '却下']
if (order === 'rej' || order === 'rej-appr') { log('PM reject →', (await decide('Y', A)).slice(0, 80)) }
if (order === 'appr' || order === 'appr-rej') { log('PM approve →', (await decide('y', A)).slice(0, 80)) }
if (order === 'chain') { // 再公開（A をもう一度変える）で Rev1 をまとめ、最後の Rev を却下
  await t.role('design'); await t.press('1'); await t.setCellKey(A, 'qtyNeeded', String(qa + 4)); log('publish 2 →', (await t.publish('1')).slice(-60)); log('PM reject last →', (await decide('Y', A)).slice(0, 80)) }
p = await t.proj(); log('subs', c.subs(p)); log('decisions', JSON.stringify(p.decisions.filter((d) => [A, D].includes(d.rowId)).map((d) => [d.rowId, d.kind, d.reason])))
if (order === 'rej-appr' || order === 'appr-rej') {
  await t.role('design'); await t.press('1'); await t.setCellKey(A, 'qtyNeeded', String(qa + 5)); log('publish 2 →', (await t.publish('1')).slice(-60)); p = await t.proj(); log('subs', c.subs(p))
  log(order === 'rej-appr' ? 'PM approve →' : 'PM reject →', (await decide(order === 'rej-appr' ? 'y' : 'Y', A)).slice(0, 80)); p = await t.proj(); log('subs', c.subs(p))
}
const rejected = p.submissions.some((s) => s.changeSet?.rejected)
const notApproved = p.submissions.filter((s) => s.changeSet && (!s.changeSet.approved || s.changeSet.rejected)).map((s) => s.rev)
log('rejected Revs', JSON.stringify(notApproved))
const out = {}
for (const role of ['design', 'purchasing', 'pm']) { out[role] = await chgDump(role); log(role, '変更点', out[role].chg.length, '行 / 決定の行', out[role].chg.filter((r) => r[4] === '決定').map((r) => [r[3], r[5], String(r[7] ?? '').slice(0, 30)]).slice(0, 8).map((x) => x.join(':')).join(' | ')) }
const purch = out.purchasing
const pDec = purch.chg.filter((r) => r[4] === '決定')
const rejDecIds = p.decisions.filter((d) => d.kind === '却下' && d.rowId && [A, D, B].includes(d.rowId)).map((d) => d.reason)
check(tag + '-1 購買の変更点に、却下した変更セットの決定（却下・理由）が出ない', !purch.chg.some((r) => r[4] === '決定' && r[5] === '却下' && [A, D].includes(r[3])), JSON.stringify(pDec.map((r) => [r[3], r[5], r[7]])))
check(tag + '-2 購買の変更点に、却下の理由の文章が出ない', !JSON.stringify(purch.chg).includes('却下の理由XYZ'), '')
check(tag + '-3 購買の変更点に、承認されていない追加行 D が出ない（承認された D は出る）', !purch.chg.some((r) => r[3] === D) || p.rows.find((r) => r.id === D)?.publishedRev != null, JSON.stringify(purch.chg.filter((r) => r[3] === D)))
check(tag + '-4 設計・PM の変更点には、却下・承認の決定が出る', order === 'chain' || order === 'rej' || order === 'appr' || true ? out.design.chg.some((r) => r[4] === '決定') && out.pm.chg.some((r) => r[4] === '決定') : true, `design ${out.design.chg.filter((r) => r[4] === '決定').length} pm ${out.pm.chg.filter((r) => r[4] === '決定').length}`)
const chkPurchD = purch.chk.filter((r) => r[0] === D)
check(tag + '-5 購買のチェック結果に、承認されていない追加行 D が出ない', !(p.rows.find((r) => r.id === D)?.publishedRev == null && chkPurchD.length), JSON.stringify(chkPurchD.slice(0, 3)))
check(tag + '-6 チェック結果の「列」「状態」は日本語（qtyNeeded・open・model などの内部名なし）', ![out.design, out.purchasing, out.pm].some((o) => o.chk.some((r) => /^(qtyNeeded|model|maker|name|unit|packQty)$/.test(String(r[1])) || /^(open|inProgress|answered|confirmed|draft)$/.test(String(r[5])))), JSON.stringify(out.design.chk.slice(0, 4)))
errs(t, tag + '-99'); summary(); await t.close()
