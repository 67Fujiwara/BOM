// n8: 発注・入荷と納期遵守の記録、取引停止（JSON 読み込み）との組み合わせ。時計 2026-10-26 09:00
//   mode=toggle: 正式納期 10 日で発注 → 7 日目に入荷 → 戻す → 14 日目に入荷し直す → Ctrl+Z／発注を外す
//   mode=stop  : 発注済の行がある商社を取引停止にする → 発注済は変わらず入荷できて記録される。発注前の行は採用を外れる（取下げ）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'toggle'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
const adq = (p, id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
async function formalAnswer(id, lead) { const p = await t.proj(); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(adq(p, id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', String(lead)); await t.press('Escape') }
async function receive(id) { await t.press('3'); await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); return t.toast() }
const stats = (S) => page.evaluate(async (S) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return sc.receiptStats(s.project(), S) }, S)
async function importTradable(sid, tradable) {
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable } : s))
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) } 
  await page.locator('.gridwrap').focus(); return t.toast()
}
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const base = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && !r.needDateFixed)
const S = base[0].adoptedSupplierId; const same = base.filter((r) => r.adoptedSupplierId === S)
const A = same[0].id, B = same[1].id, C = same[2].id
log('S', S, 'A', A, 'B', B, 'C', C)
for (const id of [A, B]) await formalAnswer(id, 10)
await t.press('Escape'); for (const id of [A, B]) log('order', id, await t.order(id))
p = await t.proj(); log('A', h.show(p, A), p.rows.find((r) => r.id === A).orderedAt)
if (mode === 'toggle') {
  await t.setTime('2026-11-02T10:00:00+09:00'); log('receive A (7 日)', await receive(A)); let st = await stats(S); log('stats', JSON.stringify(st))
  check('N8-1 7 日目の入荷（正式納期 10 日）は納期内 1/1', st?.ok === 1 && st?.total === 1, JSON.stringify(st))
  log('un-receive A', await receive(A)); p = await t.proj(); const rA = p.rows.find((r) => r.id === A); st = await stats(S); log('stats', JSON.stringify(st), h.show(p, A), 'receivedAt', rA.receivedAt)
  check('N8-2 入荷を戻すと状態は発注済・記録（入荷日）が消え、実績から外れる', rA.status === 'ordered' && !rA.receivedAt && !st, `${rA.status} ${rA.receivedAt} ${JSON.stringify(st)}`)
  await t.setTime('2026-11-12T10:00:00+09:00'); log('receive A again (17 日)', await receive(A)); st = await stats(S); p = await t.proj()
  check('N8-3 17 日目に入荷し直すと遅れ 0/1', st?.ok === 0 && st?.total === 1 && p.rows.find((r) => r.id === A).receivedAt === '2026-11-12', JSON.stringify(st) + ' ' + p.rows.find((r) => r.id === A).receivedAt)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); st = await stats(S); p = await t.proj(); log('Ctrl+Z →', await t.toast(), JSON.stringify(st), h.show(p, A))
  check('N8-4 Ctrl+Z で入荷が戻る（発注済・実績なし）', p.rows.find((r) => r.id === A).status === 'ordered' && !st, `${JSON.stringify(st)} ${p.rows.find((r) => r.id === A).status}`)
  await page.keyboard.press('Control+y'); await page.waitForTimeout(100); st = await stats(S); log('Ctrl+Y →', await t.toast(), JSON.stringify(st))
  check('N8-5 やり直しで入荷が戻る（0/1）', st?.total === 1, JSON.stringify(st))
  // 入荷済の行は設計が変えられない・購買が発注を外せない
  await t.role('design'); await t.press('1'); log('design edit received A →', await t.setCellKey(A, 'qtyNeeded', '99'))
  p = await t.proj(); check('N8-6 入荷済の行の必要数は変えられない', p.rows.find((r) => r.id === A).qtyNeeded !== 99, '')
  await t.role('purchasing'); await t.press('3'); await t.goto(A); await t.colKey('ordered'); await t.press('Enter'); await page.waitForTimeout(100); log('uncheck ordered on received →', await t.toast()); p = await t.proj()
  log('A after', h.show(p, A))
} else {
  await t.setTime('2026-11-02T10:00:00+09:00'); log('receive A', await receive(A))
  p = await t.proj(); const wasC = h.show(p, C); log('C before', wasC)
  log('import stop', S, '→', await importTradable(S, false)); p = await t.proj()
  const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B), rC = p.rows.find((r) => r.id === C)
  log('A', h.show(p, A)); log('B', h.show(p, B)); log('C', h.show(p, C))
  check('N8-1 取引停止にしても発注済（B）の採用・状態は変わらない', rB.status === 'ordered' && rB.adoptedSupplierId === S, h.show(p, B))
  check('N8-2 入荷済（A）も変わらない', rA.status === 'received' && rA.adoptedSupplierId === S, h.show(p, A))
  check('N8-3 発注前（C・正式依頼中）の採用は外れ、正式依頼の取下げが記録される', rC.adoptedSupplierId !== S && !!rC.flags.formalWithdrawn, h.show(p, C))
  log('receive B (停止後)', await receive(B)); p = await t.proj(); const st = await stats(S); log('stats', JSON.stringify(st), h.show(p, B))
  check('N8-4 停止後も発注済の行は入荷でき、実績に数える（2/2 または納期内の数）', p.rows.find((r) => r.id === B).status === 'received' && st?.total === 2, JSON.stringify(st))
  // 復帰
  log('import resume', await importTradable(S, true)); p = await t.proj(); log('C after resume', h.show(p, C))
  check('N8-5 取引再開で外した採用は黙って戻らない（C は選び直し）', p.rows.find((r) => r.id === C).adoptedSupplierId !== S, h.show(p, C))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
