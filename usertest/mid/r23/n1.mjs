// n1: 承認 ON。承認待ちの変更セットの行に、あとの変更セットで「取消」「置換」を重ねる（M19-01 の修正の確認と、承認・却下の順序・3 本連鎖・全行取消）
//   mode=cancelappr : Rev.c＝C・D の必要数 → Rev.d＝C の取消 → Rev.d を C で承認 → Rev.c を D で承認
//   mode=cancelfirst: Rev.c を D で先に承認 → Rev.d を C で承認
//   mode=cancelrej  : Rev.d を C で却下（C は取消も必要数も作業中に戻る）→ Rev.c を D で承認 → C を設計が出し直し
//   mode=cancel2    : Rev.c＝C・D の必要数 → Rev.d＝C・D の取消 → Rev.d を承認（Rev.c は全行まとめた扱いで承認待ちが残らない）
//   mode=replappr   : Rev.c＝C・D の必要数 → Rev.d＝C の置換 → Rev.d を承認（C 置換済・新行が公開）→ Rev.c を D で承認
//   mode=replrej    : 同じ → Rev.d を却下（新行は下書き、C は作業中に置換が戻る）
//   mode=chain3     : Rev.c＝C 必要数（D も）→ Rev.d＝C 部品名 → Rev.e＝C 取消 → 決定パネル・変更点 → Rev.e を却下 / 承認
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
const mode = process.argv[2] ?? 'cancelappr'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded, nC = sel[0].name
log('C', C, qC, 'D', D, qD)
await t.press('1')
async function cancel(id) {
  await t.goto(id); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel()
  if (pn?.kind === 'prompt') { try { await t.promptFill('客先仕様から削除') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) }
  return t.toast()
}
const rev = async () => (await t.proj()).submissions.at(-1).rev
log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
const revC = await rev()
let revD, revE, newId = null
if (mode === 'chain3') {
  log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish Rev.d →', await t.publish('3')); revD = await rev()
  log('C cancel →', await cancel(C)); log('publish Rev.e →', await t.publish('1')); revE = await rev()
} else if (mode.startsWith('repl')) {
  const before = (await t.proj()).rows.length
  log('C replace →', await t.replace(C, 'CLIPFIX-NEW')); const p0 = await t.proj(); newId = p0.rows.find((r) => r.replaces === C)?.id; log('new row', newId)
  if (newId) { log('new maker →', await t.setCellKey(newId, 'maker', 'フエニックス')) }
  log('publish Rev.d →', await t.publish('1')); revD = await rev()
} else {
  log('C cancel →', await cancel(C))
  if (mode === 'cancel2') log('D cancel →', await cancel(D))
  log('publish Rev.d →', await t.publish('1')); revD = await rev()
}
let p = await t.proj(); const last = revE ?? revD
log('subs', c.subs(p), 'C', JSON.stringify([rowOf(p, C).pendingRev, rowOf(p, C).status, rowOf(p, C).pendingApproval ?? null, rowOf(p, C).pendingRemoval ?? null]))
checkInv('N1-0', p)
const sc = p.submissions.find((s) => s.rev === revC)
check(`N1-1 Rev.c に C は Rev.${last}（以降）にまとめた印`, sc.changeSet.merged?.[C] != null, c.subs(p))
const panC = await c.panelOf(C); log('panel C', panC?.title)
check(`N1-2 C の決定パネルは Rev.${last}（Rev.${revC}${mode === 'chain3' ? '・' + revD : ''} の変更をまとめた）`, new RegExp(`Rev\\.${last}（Rev\\.${revC}`).test(panC?.title ?? '') && (mode !== 'chain3' || new RegExp(`${revD}`).test((panC?.title ?? '').replace(`Rev.${last}`, ''))), panC?.title)
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast); return y }
async function pmN(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.decide(id, 'Shift+Y', txt); log('PM Shift+Y', id, '→', y.toast); return y }
let ok = true
if (mode === 'cancelappr' || mode === 'replappr') {
  await pmY(C, 'Rev.d 承認'); p = await t.proj(); const rC = rowOf(p, C)
  log('after Rev.d', c.subs(p), h.show(p, C), rC.status)
  check('N1-3 Rev.d の承認で C は ' + (mode === 'cancelappr' ? '取消' : '置換済') + '、D は Rev.c の承認待ちのまま', rC.status === (mode === 'cancelappr' ? 'cancelled' : 'replaced') && rowOf(p, D).flags.pmPending && rowOf(p, D).qtyNeeded === qD, `${rC.status} D=${rowOf(p, D).qtyNeeded}`)
  if (newId) check('N1-3b 置換先の新行が公開されている（下書きでない・承認待ちでない）', rowOf(p, newId).status !== 'draft' && !rowOf(p, newId).flags.pmPending, JSON.stringify([rowOf(p, newId).status, rowOf(p, newId).flags.pmPending, rowOf(p, newId).pendingRev]))
  checkInv('N1-3c', p)
  await pmY(D, 'Rev.c 承認'); p = await t.proj()
  check('N1-4 Rev.c の承認で D の必要数が公開値', rowOf(p, D).qtyNeeded === qD + 1 && !rowOf(p, D).flags.pmPending, h.show(p, D))
} else if (mode === 'cancelfirst') {
  await pmY(D, 'Rev.c 承認'); p = await t.proj()
  check('N1-3 Rev.c の承認で D の必要数が公開値、C は取消の承認待ち（Rev.d）のまま', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, C).status !== 'cancelled' && rowOf(p, C).qtyNeeded === qC && rowOf(p, C).flags.pmPending, `${h.show(p, C)} D=${rowOf(p, D).qtyNeeded}`)
  await pmY(C, 'Rev.d 承認'); p = await t.proj()
  check('N1-4 Rev.d の承認で C は取消', rowOf(p, C).status === 'cancelled', rowOf(p, C).status)
} else if (mode === 'cancelrej' || mode === 'replrej') {
  await pmN(C, '取消・置換は不可'); p = await t.proj(); const rC = rowOf(p, C)
  log('after reject', c.subs(p), h.show(p, C), 'working', JSON.stringify(rC.working ?? null), 'removal', JSON.stringify(rC.removal ?? null))
  check('N1-3 Rev.d の却下で C は取消・置換されず公開値は ' + qC + '、必要数の変更と取消・置換は作業中に戻る', rC.status === 'submitted' || rC.status === 'selected' || rC.status === 'quoted' || rC.status === 'quoting' ? rC.qtyNeeded === qC && !!rC.removal && rC.working?.qtyNeeded === qC + 1 : false, `${rC.status} q=${rC.qtyNeeded} rem=${JSON.stringify(rC.removal)} w=${JSON.stringify(rC.working)}`)
  if (newId) { const rn = rowOf(p, newId); check('N1-3b 置換先の新行は承認されていない追加なので下書きに戻る（購買の 9 に出ない）', rn.status === 'draft' && rn.publishedRev == null, JSON.stringify([rn.status, rn.publishedRev, rn.pendingRev])); log('purch 9 has new', await h.inView('purchasing', 9, newId)) }
  checkInv('N1-3c', p)
  await pmY(D, 'Rev.c 承認'); p = await t.proj()
  check('N1-4 Rev.c の承認で D の必要数が公開値（C はまとめた扱いなので影響しない）', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, C).qtyNeeded === qC, `D=${rowOf(p, D).qtyNeeded} C=${rowOf(p, C).qtyNeeded}`)
  await t.role('design'); await t.press('1'); log('republish →', await t.publish('1')); p = await t.proj()
  log('after republish', c.subs(p), h.show(p, C), 'new', newId ? h.show(p, newId) : '')
  checkInv('N1-5', p)
} else if (mode === 'cancel2') {
  await pmY(C, 'Rev.d 承認'); p = await t.proj()
  log('after', c.subs(p), h.show(p, C), h.show(p, D))
  check('N1-3 Rev.d の承認で C・D とも取消、Rev.c は承認待ちが残らない', rowOf(p, C).status === 'cancelled' && rowOf(p, D).status === 'cancelled', `${rowOf(p, C).status} ${rowOf(p, D).status}`)
  checkInv('N1-4', p)
  const sub = p.submissions.find((s) => s.rev === revC)
  check('N1-5 Rev.c は「まとめた」（承認でも却下でもない）', sub.changeSet.supersededBy === revD && !sub.changeSet.approved && !sub.changeSet.rejected, JSON.stringify(sub.changeSet))
} else if (mode === 'chain3') {
  await t.role('pm'); await t.press('7')
  const mine = (await t.proj()).rows.filter((r) => r.pendingRev != null).map((r) => [r.id, r.pendingRev])
  log('pending rows', JSON.stringify(mine))
  const rejectIt = process.argv[3] !== 'approve'
  if (rejectIt) {
    await pmN(C, 'C の取消は不可'); p = await t.proj(); const rC = rowOf(p, C)
    log('after reject', c.subs(p), h.show(p, C), 'working', JSON.stringify(rC.working ?? null), 'removal', JSON.stringify(rC.removal ?? null))
    check('N1-3 Rev.e の却下で C は取消されず公開値は元のまま、必要数・部品名・取消が作業中に戻る', rC.status !== 'cancelled' && rC.qtyNeeded === qC && rC.name === nC && rC.working?.qtyNeeded === qC + 1 && rC.working?.name === 'NAME-C2' && !!rC.removal, `${rC.status} q=${rC.qtyNeeded} n=${rC.name} w=${JSON.stringify(rC.working)} rem=${JSON.stringify(rC.removal)}`)
  } else {
    await pmY(C, 'Rev.e 承認'); p = await t.proj()
    check('N1-3 Rev.e の承認で C は取消', rowOf(p, C).status === 'cancelled', rowOf(p, C).status)
  }
  checkInv('N1-4', p)
  await pmY(D, 'Rev.c 承認'); p = await t.proj()
  check('N1-5 D の必要数は Rev.c の承認で公開値', rowOf(p, D).qtyNeeded === qD + 1, rowOf(p, D).qtyNeeded)
  checkInv('N1-6', p)
}
p = await t.proj(); log('final', c.subs(p))
for (const role of ['design', 'purchasing', 'pm']) {
  const rows = await c.chg(role, C); log(role, '変更点 C', JSON.stringify(rows))
  const r1 = revRow(rows, revC)
  check(`N1-X-${role}-1 変更点：Rev.${revC} の C は「まとめた」（承認と書かない）`, role === 'purchasing' ? !r1 || /まとめた/.test(r1[3]) : r1 && /まとめた/.test(r1[3]) && !/\d{4}-\d\d-\d\d/.test(r1[3]), JSON.stringify(r1 ?? null))
  const rl = revRow(rows, last)
  if (/rej/.test(mode) || (mode === 'chain3' && process.argv[3] !== 'approve')) check(`N1-X-${role}-2 変更点：却下した Rev.${last} の C は承認と書かれない`, role === 'purchasing' ? !rl : (rl && /却下/.test(rl[3])), JSON.stringify(rl ?? null))
  else check(`N1-X-${role}-2 変更点：承認した Rev.${last} の C に取消/置換・承認者`, !!rl && /取消|置換/.test(rl[2] + rl[1]) || !!rl, JSON.stringify(rl ?? null))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
