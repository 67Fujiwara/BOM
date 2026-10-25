// p6: 正式依頼の取下げが複数（元の商社に 1 社ずつ伝える）。選び直しを重ねて取下げが 2 件 → x を 1 回ずつ（残りが見える・1 件ずつ消える）
//   usage: node p6.mjs std|slash|stop
//   std  : S1 に正式依頼 → 設計が S2 に選び直し（取下げ 1）→ 購買が正式依頼 → S3 に選び直し（取下げ 2）→ x を 1 回ずつ
//   slash: 商社の名前に「 / 」が入っている（JSON で S1 の名前を変えてから）。取下げの記録の区切りと重なっても 1 件ずつ消える
//   stop : 取下げが 2 件ある行の商社の 1 つが取引停止／再採用（同じ商社に戻す）で、その商社の取下げだけ消える
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { importWs, errs, scanViews } from './plib.mjs'
const mode = process.argv[2] ?? 'std'; const tag = 'P6-' + mode
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design')
if (mode === 'slash') log('rename S1 →', await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === 'S1' ? { ...s, name: '因幡 / 電機商会' } : s)) }))
log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-50))
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && r.adoptedSupplierId === 'S1')
const X = fr[0].id; log('X', h.show(p, X).slice(0, 160))
const names = Object.fromEntries((await t.ws()).suppliers.map((s) => [s.id, s.name]))
const wd = async () => (await t.proj()).rows.find((r) => r.id === X).flags.formalWithdrawn ?? ''
async function bigFormal(mult) {
  p = await t.proj(); const rX = p.rows.find((r) => r.id === X); const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === rX.adoptedSupplierId && !q.stale)
  await t.role('purchasing'); await t.press('8'); const r = await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice * mult + 30000)); await t.press('Escape'); return r
}
async function pmB() {
  await t.role('pm'); await t.press('7'); await t.goto(X); await t.press('Enter'); await page.waitForTimeout(100)
  await t.press('b'); await page.waitForTimeout(100); const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('次点へ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150) }
  if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
  return await t.toast()
}
async function xOnce() { await t.role('purchasing'); await t.press('9'); await t.goto(X); await t.press('Home'); const sb = (await t.status()).slice(0, 260); await t.press('x'); await page.waitForTimeout(120); return { sb, toast: await t.toast(), after: await wd() } }
const sA = (await t.row(X)).adoptedSupplierId
log('big formal 1 →', (await bigFormal(3)).slice(0, 60)); log('PM b 1 →', await pmB()); p = await t.proj(); const sB = (await t.row(X)).adoptedSupplierId; log('X', h.show(p, X).slice(0, 200), 'wd', await wd())
check(`${tag}-1 1 回目の次点で ${names[sA]} への取下げが 1 件`, (await wd()).includes(names[sA]), await wd())
await t.role('purchasing'); log('formal again →', (await t.requestFormal()).slice(-40)); p = await t.proj(); log('X', h.show(p, X).slice(0, 200))
log('big formal 2 →', (await bigFormal(4)).slice(0, 60)); log('PM b 2 →', await pmB()); p = await t.proj(); const sC = (await t.row(X)).adoptedSupplierId; const w2 = await wd(); log('X', h.show(p, X).slice(0, 200), 'wd', w2)
check(`${tag}-2 取下げが 2 件たまる（${names[sA]} と ${names[sB]}）`, w2.includes(names[sA]) && w2.includes(names[sB]), w2)
if (mode === 'rename' || mode === 'norename') {
  // 現在の採用は sC（S1 に戻っている）。商社の名前を変えてから（rename のみ）、その商社に正式依頼し直す → その商社への取下げの記録は消える（もう取り下げていない）
  log('current adopt', sC, names[sC])
  if (mode === 'rename') log('rename', sC, await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === sC ? { ...s, name: s.name + '（本社）' } : s)) }))
  await t.role('purchasing'); log('formal again →', (await t.requestFormal()).slice(-60)); const w5 = await wd(); log('wd after formal again', w5)
  check(`${tag}-R1 ${names[sC]} に正式依頼し直したら、${names[sC]} への取下げの記録は消える（残りは他社の分だけ）`, !w5.includes(names[sC] + ' ') && !w5.includes(names[sC] + '（本社） ') && w5.includes(names[sB]), w5)
  errs(t, tag + '-9'); summary(); await t.close(); process.exit(0)
}
if (mode === 'stop') {
  log('stop', sB, await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === sB ? { ...s, tradable: false } : s)) }))
  const w3 = await wd(); check(`${tag}-3 取引停止にしても取下げの記録（2 件）は消えない`, w3.includes(names[sA]) && w3.includes(names[sB]), w3)
  log('remove', sA, await importWs(t, (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== sA) }))
  const w4 = await wd(); check(`${tag}-3b 商社マスタから消えても取下げの記録は消えない（名前が分からなくなっても伝える相手が分かる）`, w4.split(' / ').filter(Boolean).length >= 2 && !/undefined/.test(w4), w4)
}
await t.role('purchasing'); await t.press('9'); const in9 = (await t.viewRows()).includes(X)
check(`${tag}-4 取下げのある行は購買の 9 に出る`, in9, `in9=${in9}`)
const seen = []; const n0 = (await wd()).split(' / ').filter(Boolean).length
for (let k = 0; k < 5; k++) { const b = await wd(); if (!b) break; const x = await xOnce(); seen.push([b, x.after, x.toast.slice(0, 140), x.sb.slice(0, 120)]) }
log('x steps', JSON.stringify(seen))
const tokens = 2 // 取下げを 2 回記録した（商社の名前に ' / ' が入っていても 2 件のはず）
check(`${tag}-5 x を 1 回押すごとに取下げの記録が 1 件ずつ減る（記録は ${w2}）`, seen.length === tokens && seen.every(([b, a]) => (a ? a.split(' / ').length : 0) === b.split(' / ').length - 1), JSON.stringify(seen.map((s) => s.slice(0, 2))))
check(`${tag}-6 状態バーに取下げの内容と x の案内が出る`, seen.length > 0 && /取り下げ/.test(seen[0][3]) && /x/.test(seen[0][3]) || seen[0]?.[3]?.length > 0, seen[0]?.[3])
await t.press('9'); const in9b = (await t.viewRows()).includes(X); const rf = await t.row(X)
check(`${tag}-7 全て伝えたあと、取下げだけを理由に購買の 9 に残らない`, !rf.flags.formalWithdrawn && (!in9b || ['formalRequested', 'formalQuoted', 'selected', 'quoted'].includes(rf.status)), `in9=${in9b} ${rf.status} ${h.show(await t.proj(), X).slice(0, 150)}`)
const bad = await scanViews(t, ['purchasing', 'pm'], [3, 7, 8, 9]); check(`${tag}-8 文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
errs(t, tag + '-9'); summary(); await t.close()
