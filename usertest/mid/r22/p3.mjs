// p3: 承認 ON。既存の選定済の行 D を Rev.c で必要数 +1、Rev.d で 取消（cancel）／置換（repl）／必要数をさらに +1（qty）にして、承認・却下の全順序を試す
//   usage: node p3.mjs cancel|repl|qty A3,A4
//   期待（M20-02／M21-07 の流儀）: D の最終状態は後の Rev（Rev.d）の決定で決まる。承認待ちが残らない・不変条件・購買の 9 と変更点・3 役割の Excel
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
import { lintXlsx, errs } from './plib.mjs'
const kind = process.argv[2] ?? 'cancel'; const order = (process.argv[3] ?? 'A3,A4').split(','); const tag = `${kind}-${order.join('')}`
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup(); const D = sel[1].id, qD = sel[1].qtyNeeded, E = sel[2].id
await t.press('1'); log('D', D, 'q', qD, 'E', E)
log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', (await t.publish('1')).slice(-30))
let p = await t.proj(); const revC = p.submissions.at(-1).rev
if (kind === 'cancel') { await t.goto(D); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(150); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) } }
else if (kind === 'repl') { log('replace →', await t.replace(D, 'REPL-MODEL-1')) }
else { log('D qty again →', await t.setCellKey(D, 'qtyNeeded', String(qD + 2))) }
log('publish Rev.d →', (await t.publish('3')).slice(-40))
p = await t.proj(); const revD = p.submissions.at(-1).rev; log('subs', c.subs(p)); checkInv(`P3-${tag}-0`, p)
const newId = p.rows.find((r) => r.replacedFrom === D || r.replaces === D)?.id
log('D', h.show(p, D).slice(0, 160), 'new', newId ?? '-')
const idOf = (rv) => (String(rv) === String(revC) ? D : D)
let pendFirst = rowOf(p, D).pendingRev; log('D pendingRev', pendFirst, 'revC', revC, 'revD', revD)
for (const tok of order) {
  const rv = tok[1] === '3' ? revC : revD
  await t.role('pm'); await t.press('7')
  const pn = await c.panelOf(D); log('   panel for D:', JSON.stringify(pn?.title ?? pn?.lines?.slice?.(0, 2) ?? null))
  await t.role('pm'); await t.press('7')
  const r = tok[0] === 'A' ? await t.yes(D, tok) : await t.decide(D, 'Shift+Y', tok)
  p = await t.proj(); log('PM', tok, '→', r.toast.slice(0, 90), '|', c.subs(p), '|', h.show(p, D).slice(0, 110)); checkInv(`P3-${tag}-after-${tok}`, p)
}
p = await t.proj(); const rD = rowOf(p, D); const eff = order[0][0] // D のカードは 1 枚（Rev.c は Rev.d にまとめ済）。最初の決定がすべてを決める
const rN = newId ? rowOf(p, newId) : null
log('final', h.show(p, D).slice(0, 200), 'q', rD.qtyNeeded, JSON.stringify(rD.working ?? null), rN ? '| new ' + h.show(p, newId).slice(0, 120) : '')
check(`P3-${tag}-1 承認待ちの変更セットが残らない（行に pendingRev なし）`, !p.submissions.some((s) => s.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null) && !p.rows.some((r) => r.pendingRev != null), c.subs(p))
if (kind === 'cancel') {
  if (eff === 'A') check(`P3-${tag}-2 承認で D は取消`, rD.status === 'cancelled', rD.status)
  else check(`P3-${tag}-2 却下で D は取消されない・removal が残らない・必要数は元の ${qD}`, rD.status !== 'cancelled' && !rD.pendingRemoval && !rD.removal && rD.qtyNeeded === qD, `${rD.status} q=${rD.qtyNeeded} rem=${JSON.stringify(rD.removal ?? null)} prem=${JSON.stringify(rD.pendingRemoval ?? null)}`)
} else if (kind === 'repl') {
  if (eff === 'A') check(`P3-${tag}-2 承認で D は置換済、新しい行がある`, rD.status === 'replaced' && !!rN && rN.status !== 'draft', `${rD.status} new=${newId} ${rN?.status}`)
  else check(`P3-${tag}-2 却下で D は置換済にならない・新しい行は公開されない・必要数は元の ${qD}`, rD.status !== 'replaced' && (!rN || rN.status === 'draft' || rN.status === 'cancelled') && rD.qtyNeeded === qD, `${rD.status} q=${rD.qtyNeeded} new=${newId} ${rN?.status}`)
} else {
  if (eff === 'A') check(`P3-${tag}-2 承認で D の必要数は ${qD + 2}`, rD.qtyNeeded === qD + 2, `q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
  else check(`P3-${tag}-2 却下で D の必要数は元の ${qD}、作業中は ${qD + 2}`, rD.qtyNeeded === qD && rD.working?.qtyNeeded === qD + 2, `q=${rD.qtyNeeded} w=${JSON.stringify(rD.working ?? null)}`)
}
// 購買：9・変更点・Excel
const n0 = t.downloads.length
for (const role of ['design', 'purchasing', 'pm']) {
  await t.role(role); const ex = await c.excel(0)
  const bom = ex.find((s) => s.sh === 'BOM'); const hasD = bom.rows.some((r) => r[0] === D)
  const chgD = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === D && r[0] !== '').map((r) => [r[0], r[5], String(r[7] ?? '').slice(0, 60), String(r[8] ?? '').slice(0, 30)])
  log(role, 'BOM has D', hasD, '変更点 D', JSON.stringify(chgD))
  if (role === 'purchasing') {
    const rejRev = eff === 'R' ? revC : null, rejD = eff === 'R' ? revD : null
    check(`P3-${tag}-X-purchasing-1 購買の変更点に却下した Rev の D が出ない`, !(rejRev && revRow(chgD, rejRev)) && !(rejD && revRow(chgD, rejD)), JSON.stringify(chgD))
    if (eff === 'A') { const last = revRow(chgD, revD); check(`P3-${tag}-X-purchasing-2 購買の変更点に承認した Rev.${revD} の D が内容つきで出る`, !!last && last[2].length > 0, JSON.stringify(chgD)) }
  } else {
    const last = revRow(chgD, revD)
    check(`P3-${tag}-X-${role}-2 変更点の最後の Rev.${revD} の D の内容が空でない（却下も含め）`, !!last && last[2].length > 0, JSON.stringify(chgD))
  }
}
const lb = await lintXlsx(t.downloads.slice(n0)); check(`P3-${tag}-Y Excel に undefined/NaN が出ない（チェック結果の内部名は M22-01 として別に数える）`, lb.filter((x) => !/チェック結果/.test(x)).length === 0, lb.filter((x) => !/チェック結果/.test(x)).slice(0, 4))
errs(t, `P3-${tag}-Z`); summary(); await t.close()
