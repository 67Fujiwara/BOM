// n15: 承認 ON。1 つの変更セットの行が、別々のあとの変更セットにまとめられる（扇形）
//   Rev.c＝C・D の必要数 → Rev.d＝C の部品名 → Rev.e＝D の部品名
//   mode=appr : Rev.d(C) 承認 → Rev.e(D) 承認   mode=rej: Rev.e(D) 却下 → Rev.d(C) 承認   mode=rev: Rev.e(D) 承認 → Rev.d(C) 却下
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf, revRow } from './nlib.mjs'
const mode = process.argv[2] ?? 'appr'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id, qC = sel[0].qtyNeeded, qD = sel[1].qtyNeeded, nC = sel[0].name, nD = sel[1].name
await t.press('1')
const rev = async () => (await t.proj()).submissions.at(-1).rev
async function pmY(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.yes(id, txt); log('PM y', id, '→', y.toast); return y }
async function pmN(id, txt) { await t.role('pm'); await t.press('7'); const y = await t.decide(id, 'Shift+Y', txt); log('PM Shift+Y', id, '→', y.toast); return y }
log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1')); const revC = await rev()
log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish Rev.d →', await t.publish('3')); const revD = await rev()
log('D name →', await t.setCellKey(D, 'name', 'NAME-D2')); log('publish Rev.e →', await t.publish('6')); const revE = await rev()
let p = await t.proj(); log('subs', c.subs(p)); checkInv('N15-0', p)
const panC = await c.panelOf(C), panD = await c.panelOf(D); log('panel C', panC?.title, '| panel D', panD?.title)
check(`N15-1 C のパネルは Rev.${revD}（Rev.${revC} の変更をまとめた）、D のパネルは Rev.${revE}（Rev.${revC} の変更をまとめた）`, new RegExp(`Rev\\.${revD}（Rev\\.${revC} の変更をまとめた）`).test(panC?.title ?? '') && new RegExp(`Rev\\.${revE}（Rev\\.${revC} の変更をまとめた）`).test(panD?.title ?? ''), `${panC?.title} | ${panD?.title}`)
const exp = {}
if (mode === 'appr') {
  await pmY(C, 'Rev.d'); p = await t.proj(); check('N15-2 Rev.d の承認で C の必要数・部品名が公開値、D は変わらず', rowOf(p, C).qtyNeeded === qC + 1 && rowOf(p, C).name === 'NAME-C2' && rowOf(p, D).qtyNeeded === qD && rowOf(p, D).flags.pmPending, h.show(p, C) + ' | ' + h.show(p, D)); checkInv('N15-2c', p)
  await pmY(D, 'Rev.e'); p = await t.proj(); check('N15-3 Rev.e の承認で D の必要数・部品名が公開値', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, D).name === 'NAME-D2', h.show(p, D)); checkInv('N15-3c', p)
} else if (mode === 'rej') {
  await pmN(D, 'Rev.e 却下'); p = await t.proj(); check('N15-2 Rev.e の却下で D は公開値のまま、必要数・部品名は作業中に戻る。C は Rev.d の承認待ちのまま', rowOf(p, D).qtyNeeded === qD && rowOf(p, D).name === nD && rowOf(p, D).working?.qtyNeeded === qD + 1 && rowOf(p, D).working?.name === 'NAME-D2' && rowOf(p, C).flags.pmPending, h.show(p, D)); checkInv('N15-2c', p)
  await pmY(C, 'Rev.d'); p = await t.proj(); check('N15-3 Rev.d の承認で C の必要数・部品名が公開値', rowOf(p, C).qtyNeeded === qC + 1 && rowOf(p, C).name === 'NAME-C2', h.show(p, C)); checkInv('N15-3c', p)
} else {
  await pmY(D, 'Rev.e'); p = await t.proj(); check('N15-2 Rev.e の承認で D が公開値', rowOf(p, D).qtyNeeded === qD + 1 && rowOf(p, D).name === 'NAME-D2', h.show(p, D)); checkInv('N15-2c', p)
  await pmN(C, 'Rev.d 却下'); p = await t.proj(); check('N15-3 Rev.d の却下で C は公開値のまま、必要数・部品名は作業中に戻る', rowOf(p, C).qtyNeeded === qC && rowOf(p, C).name === nC && rowOf(p, C).working?.qtyNeeded === qC + 1, h.show(p, C) + ' w=' + JSON.stringify(rowOf(p, C).working)); checkInv('N15-3c', p)
}
log('final', c.subs(p))
for (const role of ['design', 'purchasing', 'pm']) {
  const rc = await c.chg(role, C), rd = await c.chg(role, D); log(role, 'C', JSON.stringify(rc), 'D', JSON.stringify(rd))
  const c1 = revRow(rc, revC), d1 = revRow(rd, revC)
  check(`N15-X-${role}-1 Rev.${revC} の C は「Rev ${revD} にまとめた」、D は「Rev ${revE} にまとめた」`, role === 'purchasing' ? (!c1 || new RegExp(`Rev ${revD} にまとめた`).test(c1[3])) && (!d1 || new RegExp(`Rev ${revE} にまとめた`).test(d1[3])) : c1 && d1 && new RegExp(`Rev ${revD} にまとめた`).test(c1[3]) && new RegExp(`Rev ${revE} にまとめた`).test(d1[3]), JSON.stringify([c1, d1]))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
