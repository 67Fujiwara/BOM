// p1: 商社マスタから商社を消す（JSON 読み込み）。行・見積・指定先・quoteTargets・requestRevs が参照していても整合する（文字 undefined なし・例外なし・固まる行なし）
//   usage: p1.mjs <S1|S2|S3> <stage>   stage: sel（選定まで）/ formal（正式依頼中・見積済・発注済・入荷済を混ぜる）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { scanViews, lintXlsx, refs, importWs, errs, stuck } from './plib.mjs'
const SID = process.argv[2] ?? 'S1'; const stage = process.argv[3] ?? 'formal'; const tag = `P1-${SID}-${stage}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
if (stage !== 'sel') {
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  p = await t.proj()
  const mine = p.rows.filter((r) => r.status === 'formalRequested' && r.adoptedSupplierId === SID && r.procurement === '相見積' && !r.needDateFixed)
  log('formalRequested rows of', SID, mine.length)
  const adq = (id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
  if (mine.length >= 3) {
    const [A, B, E] = mine.map((r) => r.id)
    await t.press('8')
    for (const id of [A, B, E]) { await t.setCellKey(id, `q.formalPrice@A`, String(adq(id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, `q.formalLeadDays@A`, '10'); await t.press('Escape') }
    for (const id of [A, B]) log('order', id, await t.order(id))
    await t.setTime('2026-11-02T10:00:00+09:00'); await t.press('3'); await t.goto(A); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100)
  }
}
// 参照を足す：quoteTargets に SID（見積中の行がなければ数行に）、requestRevs
await t.role('purchasing'); const n0 = t.downloads.length
log('rough request →', JSON.stringify((await h.requestTo(null)).msg))
p = await t.proj(); log('requestRevs', JSON.stringify(p.requestRevs))
const sname = (await t.ws()).suppliers.find((s) => s.id === SID).name
log('rows referencing', SID, 'adopted', p.rows.filter((r) => r.adoptedSupplierId === SID).length, 'designated', p.rows.filter((r) => (r.designated ?? '').trim() === SID).length, 'quoteTargets', p.rows.filter((r) => (r.quoteTargets ?? []).includes(SID)).length, 'quotes', p.quotes.filter((q) => q.supplierId === SID).length)
// 消す
const adoptedBeforeIds = p.rows.filter((r) => r.adoptedSupplierId === SID && !['ordered', 'received'].includes(r.status) && r.procurement === '相見積').map((r) => r.id)
const msg = await importWs(t, (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== SID) })
log('import →', msg); p = await t.proj(); const ws = await t.ws()
const rf = refs(p, ws.suppliers); log('refs', JSON.stringify(rf.slice(0, 12)), 'n=', rf.length, 'soft', refs(p, ws.suppliers, true).length)
check(`${tag}-1 マスタに無い商社を指す参照が残らない（採用・quoteTargets・指定先）`, rf.length === 0, rf.slice(0, 8))
{ const pp = await t.proj(); const lost = pp.rows.filter((r) => adoptedBeforeIds.includes(r.id) && !r.adoptedSupplierId); const noted = lost.filter((r) => r.flags.droppedStopped || r.flags.formalWithdrawn)
  log('採用を外された行', lost.length, 'うち知らせ(droppedStopped／取下げ)付き', noted.length)
  check(`${tag}-2b マスタから消えて採用が外れた相見積の行（${lost.length} 行）に、取引停止のときと同じ「採用を外した」知らせ（droppedStopped）が付く`, lost.length > 0 && lost.every((r) => !!r.flags.droppedStopped), `知らせ付き ${noted.length}/${lost.length}（${JSON.stringify(lost[0]?.flags)}）`) }
const bad = await scanViews(t); log('bad cells', bad.length, JSON.stringify(bad.slice(0, 8)))
check(`${tag}-2 全ビュー×3 役割の文字に undefined/NaN/null が出ない`, bad.length === 0, bad.slice(0, 8))
const sk = await stuck(t); log('stuck', JSON.stringify(sk.slice(0, 10)))
check(`${tag}-3 固まる行（ボールなし・ボールの役割のビューに載らない）がない`, sk.length === 0, sk.slice(0, 8))
// 指定商社の行の指定先が消えた商社：設計に見える「指定先がマスタに無い」エラーが出る（黙って固まらない）
const desig = p.rows.filter((r) => r.procurement === '指定商社' && (r.designated ?? '').trim() === SID)
for (const r of desig) {
  const pr = await page.evaluate(async (id) => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return m.checkRow(p.rows.find((x) => x.id === id), s.ws.rules, p).map((x) => x.message) }, r.id)
  check(`${tag}-3b 指定先が消えた ${r.id} は採用が外れ、設計に「マスタにありません」のエラーが出る`, !r.adoptedSupplierId && pr.some((m) => /マスタにありません/.test(m)), `${r.status} ${JSON.stringify(pr)}`)
}
// Excel：3 役割×3 出力先
const nx = t.downloads.length
for (const role of ['design', 'purchasing', 'pm']) { await t.role(role); for (const i of [0, 1, 2]) { try { await c.excel(i) } catch (e) { log('excel EXC', role, i, e.message) } } }
const xb = await lintXlsx(t.downloads.slice(nx)); log('excel files', t.downloads.length - nx, 'bad', xb.length, JSON.stringify(xb.slice(0, 6)))
check(`${tag}-4 Excel（3 役割×3 出力先）に undefined/NaN/内部名が出ない`, xb.length === 0 && t.downloads.length - nx >= 6, xb.slice(0, 6))
// 採用パネル・スコア内訳・決定パネル（消えた商社の見積が残る行）
await t.role('design'); await t.press('2')
const rowsQ = (await t.proj()).rows.filter((r) => r.status === 'quoted' || r.status === 'quoting' || r.status === 'selected').slice(0, 6)
const panelBad = []
for (const r of rowsQ) {
  await t.goto(r.id)
  await page.keyboard.press('Space'); await page.waitForTimeout(80)
  let tx = await page.evaluate(() => document.body.innerText); if (/undefined|NaN/.test(tx)) panelBad.push(r.id + ' Space: ' + (tx.match(/.{0,25}(undefined|NaN).{0,25}/)?.[0] ?? '').replace(/\n/g, ' '))
  await page.keyboard.press('Escape'); if (await t.panel()) await page.keyboard.press('Escape')
  await t.press('Shift+A'); await page.waitForTimeout(100); tx = await page.evaluate(() => document.body.innerText); if (/undefined|NaN/.test(tx)) panelBad.push(r.id + ' Shift+A: ' + (tx.match(/.{0,25}(undefined|NaN).{0,25}/)?.[0] ?? '').replace(/\n/g, ' '))
  await page.keyboard.press('Escape'); if (await t.panel()) await page.keyboard.press('Escape')
}
log('panelBad', JSON.stringify(panelBad)); check(`${tag}-5 スコア内訳・採用パネルに undefined が出ない`, panelBad.length === 0, panelBad)
// 概算見積の依頼先・商社を集約
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(120); let pr = await t.panel(); log('rough panel', JSON.stringify(pr?.options)); const pbad = JSON.stringify(pr).match(/undefined/)
check(`${tag}-6 概算見積の依頼先に消えた商社・undefined が出ない`, !pbad && !(pr?.options ?? []).some((o) => o.startsWith(SID + ' ')), JSON.stringify(pr?.options)); await t.press('Escape'); if (await t.panel()) await t.press('Escape')
await t.role('design'); await t.cmd('商社を集約'); await page.waitForTimeout(200); pr = await t.panel(); log('consolidate panel', JSON.stringify(pr?.options?.slice(0, 5)))
check(`${tag}-7 商社を集約の候補に消えた商社・undefined が出ない`, pr == null || (!JSON.stringify(pr).includes('undefined') && !(pr.options ?? []).some((o) => o.includes(sname))), JSON.stringify(pr?.options?.slice(0, 4)))
await t.press('Escape'); if (await t.panel()) await t.press('Escape')
// 再読み込み後も同じ
await t.reload(); const bad2 = await scanViews(t, ['purchasing'], [3, 5, 6, 8, 9]); check(`${tag}-8 再読み込み後も文字がおかしくならない`, bad2.length === 0, bad2.slice(0, 5))
errs(t, tag + '-9'); summary(); await t.close()
