// o2: 承認 ON。追加行 N を Rev.c（N 追加＋D 必要数）で出し、Rev.d（N の部品名）にまとめたあと、承認・却下の全順序を試す
//   usage: node o2.mjs A3,A4  （A3＝Rev.c を D で承認／R3＝却下、A4＝Rev.d を N で承認／R4＝却下。左から順に決める）
//   期待: Rev.d を承認 → N は公開（部品名 追加行N2）。Rev.d を却下 → N は下書きに戻る（Rev.c の承認／却下の前後を問わない）
//         Rev.c の承認 → D の必要数が公開。却下 → D は作業中。購買の Excel（BOM／変更点）に N は承認されたときだけ。変更点の最後の Rev の内容は空にならない（U20-02）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
const order = (process.argv[2] ?? 'A3,A4').split(',')
const tag = order.join('')
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const D = sel[1].id, qD = sel[1].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
log('N', N, 'D', D)
log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
const rev = async () => (await t.proj()).submissions.at(-1).rev
const revC = await rev()
log('N name →', await t.setCellKey(N, 'name', '追加行N2')); log('publish Rev.d →', await t.publish('3'))
const revD = await rev(); let p = await t.proj()
log('subs', c.subs(p))
checkInv(`O2-${tag}-0`, p)
check(`O2-${tag}-1 前提：N は Rev.${revD} の承認待ち、Rev.${revC} に N のまとめ印`, rowOf(p, N).pendingRev === revD && p.submissions.find((s) => s.rev === revC).changeSet.merged?.[N] === revD, c.subs(p))
async function pmDo(tok) {
  const [k, rv] = [tok[0], tok[1]]; const id = rv === '3' ? D : N
  await t.role('pm'); await t.press('7')
  const r = k === 'A' ? await t.yes(id, `Rev.${rv} ${tok}`) : await t.decide(id, 'Shift+Y', `Rev.${rv} ${tok}`)
  log('PM', tok, id, '→', r.toast); p = await t.proj(); log('   ', c.subs(p), h.show(p, N).slice(0, 110)); checkInv(`O2-${tag}-after-${tok}`, p)
}
for (const tok of order) await pmDo(tok)
p = await t.proj()
const dec4 = order.find((x) => x[1] === '4'), dec3 = order.find((x) => x[1] === '3')
const rN = rowOf(p, N), rD = rowOf(p, D)
log('N full', JSON.stringify({ working: rN.working, pendingApproval: rN.pendingApproval, pendingRev: rN.pendingRev, publishedRev: rN.publishedRev, status: rN.status, flags: rN.flags, removal: rN.removal }))
if (dec4 === 'A4') check(`O2-${tag}-2 Rev.d 承認で N は公開（提出済・承認待ちなし・部品名 追加行N2）`, rN.status === 'submitted' && !rN.flags.pmPending && rN.pendingRev == null && rN.name === '追加行N2' && rN.publishedRev != null, h.show(p, N) + ' name=' + rN.name)
else check(`O2-${tag}-2 Rev.d 却下で N は下書き（公開の印・承認待ちの印なし。removal なし）`, rN.status === 'draft' && rN.publishedRev == null && !rN.flags.pmPending && rN.pendingRev == null && !rN.removal && !rN.pendingRemoval, `${rN.status} pub=${rN.publishedRev} pm=${rN.flags.pmPending} rem=${JSON.stringify(rN.removal)}`)
if (dec3 === 'A3') check(`O2-${tag}-3 Rev.c 承認で D の必要数が公開値`, rD.qtyNeeded === qD + 1 && !rD.flags.pmPending && !rD.working, `D q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
else check(`O2-${tag}-3 Rev.c 却下で D は元の必要数、作業中に ${qD + 1}`, rD.qtyNeeded === qD && rD.working?.qtyNeeded === qD + 1 && !rD.flags.pmPending, `D q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
check(`O2-${tag}-4 承認待ちの変更セットが残らない`, !p.submissions.some((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null), c.subs(p))
// 購買の 9・概算見積の依頼
await t.role('purchasing'); const in9 = await h.inView('purchasing', 9, N)
const n0r = t.downloads.length; const rq = await h.requestTo(null); await page.waitForTimeout(1500); const inRough = (await h.files(n0r)).some((f) => f.ids.includes(N))
check(`O2-${tag}-5 購買の 9・概算見積の依頼に N が出るのは Rev.d を承認したときだけ`, (in9 && inRough) === (dec4 === 'A4') && (in9 || !inRough), `in9=${in9} inRough=${inRough}`)
// Excel（役割ごと）
for (const role of ['design', 'purchasing', 'pm']) {
  await t.role(role); const ex = await c.excel(0)
  const bom = ex.find((s) => s.sh === 'BOM'); const hasN = bom.rows.some((r) => r[0] === N)
  const chgN = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === N && r[0] !== '').map((r) => [r[0], r[5], String(r[7] ?? ''), String(r[8] ?? '')])
  const chgD = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === D && r[0] !== '').map((r) => [r[0], r[5], String(r[7] ?? ''), String(r[8] ?? '')])
  log(role, 'BOM has N', hasN, '変更点 N', JSON.stringify(chgN), '変更点 D', JSON.stringify(chgD))
  if (dec4 === 'A4') check(`O2-${tag}-X-${role}-1 BOM シートに N あり`, hasN, '')
  else log('INFO', role, '却下で下書きに戻った N が BOM シートに', hasN ? 'ある（下書きとして。画面の 1/2 と同じ）' : 'ない')
  if (role === 'purchasing') {
    if (dec4 !== 'A4') check(`O2-${tag}-X-${role}-2 購買の変更点に N の行が出ない（承認されなかった追加）`, chgN.length === 0, JSON.stringify(chgN))
    else {
      const last = revRow(chgN, revD)
      check(`O2-${tag}-X-${role}-2 購買の変更点に Rev.${revD} の N が内容つきで出る（最終の部品名 追加行N2）`, !!last && /追加行N2/.test(last[2]), JSON.stringify(chgN))
    }
    if (dec3 !== 'A3') check(`O2-${tag}-X-${role}-3 購買の変更点に却下した Rev.${revC} の D が出ない`, !revRow(chgD, revC), JSON.stringify(chgD))
    else check(`O2-${tag}-X-${role}-3 購買の変更点に承認した Rev.${revC} の D が出る`, !!revRow(chgD, revC), JSON.stringify(chgD))
  } else {
    const last = revRow(chgN, revD)
    if (dec4 === 'A4') check(`O2-${tag}-X-${role}-2 変更点：承認した Rev.${revD} の N の内容が空でない（最終の部品名 追加行N2。U20-02）`, !!last && /追加行N2/.test(last[2]), JSON.stringify(chgN))
    else log('INFO', role, '却下した Rev の内容', JSON.stringify(last ?? null))
    check(`O2-${tag}-X-${role}-4 変更点：Rev.${revD} の N の「承認」の欄に決定（承認者／却下）が出る`, !!last && /鈴木|却下|田中|部長|\d{4}/.test(last[3]), JSON.stringify(last))
  }
}
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
