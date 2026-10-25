// m5: 概算「在庫」の商社の正式納期（M18-02 の修正の先）。時計 2026-10-26 09:00
//   mode=impact : 在庫の X・在庫でない Y に正式納期 15 日（必要日まで 18 日なので納期内）→ PM が案件納期を 7 日前倒し → 影響試算の納期NG に X が入る → 確定で X が納期NG・PM の 7
//   mode=receipt: 在庫の 2 行・在庫でない 1 行を正式納期 10 日で回答 → 発注 → 入荷（7 日・14 日・7 日）→ 実績「入荷 2/3 件が納期内」
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'impact'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
const adq = (p, id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
async function formalAnswer(id, lead) { const p = await t.proj(); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(adq(p, id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', String(lead)); await t.press('Escape') }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const base = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && !r.needDateFixed)
if (mode === 'impact') {
  const X = base.find((r) => adq(p, r.id)?.stock === '在庫').id, Y = base.find((r) => adq(p, r.id)?.stock !== '在庫' && r.id !== X).id
  log('X', h.show(p, X), 'Y', h.show(p, Y), 'need X', await t.cellText(X, 'needDate'), 'due', p.dueDate)
  await formalAnswer(X, 15); await formalAnswer(Y, 15)
  p = await t.proj(); log('after formal', h.show(p, X), '|', h.show(p, Y))
  check('M5I-0 正式納期 15 日（必要日まで 18 日）では X・Y とも納期NG でない', !p.rows.find((r) => r.id === X).flags.leadNG && !p.rows.find((r) => r.id === Y).flags.leadNG, `${h.show(p, X)} | ${h.show(p, Y)}`)
  const due2 = new Date(new Date(p.dueDate + 'T00:00:00Z').getTime() - 7 * 864e5).toISOString().slice(0, 10)
  await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80)
  const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'dueDate') })
  for (let k = 0; k < idx; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.getByTestId('settings-input').fill(due2); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(150)
  const imp = await page.getByTestId('impact').textContent().catch(() => ''); log('impact', imp)
  const sim = await page.evaluate(async (due2) => { const m = await import(window.__m('/src/actions/pm.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.simulateSettings(s.project(), { dueDate: due2 }).leadNG.map((x) => x.rowId) }, due2)
  log('simulate leadNG ids', JSON.stringify(sim))
  check('M5I-1 影響試算の「納期NG になる行」に、概算在庫・正式納期 15 日の X（と対照の Y）が入る', sim.includes(X) && sim.includes(Y), JSON.stringify({ X, Y, sim }))
  await t.press('Enter'); await page.waitForTimeout(100); let pn = await t.panel(); let g = 0
  while (pn && g++ < 4) { try { await t.promptFill('客先の納期前倒し') } catch {} ; await t.press('Enter'); await page.waitForTimeout(120); pn = await t.panel() }
  log('settings →', await t.toast())
  p = await t.proj(); log('after', h.show(p, X), 'case', await h.caseOf(X), '|', h.show(p, Y), 'case', await h.caseOf(Y), 'due', p.dueDate)
  check('M5I-2 確定後、X（概算在庫・正式 15 日）も納期NG で PM の 7（対照の Y と同じ）', !!p.rows.find((r) => r.id === X).flags.leadNG && (await h.caseOf(X)) === '納期NG' && !!p.rows.find((r) => r.id === Y).flags.leadNG, `${h.show(p, X)} | ${h.show(p, Y)}`)
} else {
  // 在庫の行を 2 つ以上持つ採用商社
  const bySup = {}; for (const r of base) { const q = adq(p, r.id); (bySup[r.adoptedSupplierId] ??= { stock: [], other: [] })[q?.stock === '在庫' ? 'stock' : 'other'].push(r.id) }
  log('bySup', JSON.stringify(bySup))
  const S = Object.keys(bySup).find((k) => bySup[k].stock.length >= 2 && bySup[k].other.length >= 1)
  const [A, B] = bySup[S].stock, C = bySup[S].other[0]
  const otherRow = p.rows.find((r) => r.status === 'formalRequested' && r.adoptedSupplierId !== S && p.quotes.some((q) => q.rowId === r.id && q.supplierId === S && !q.stale && q.unitPrice != null)).id
  log('S', S, 'A,B (在庫)', A, B, 'C', C, 'other', otherRow)
  for (const id of [A, B, C]) await formalAnswer(id, 10)
  await t.press('Escape'); for (const id of [A, B, C]) log('order', id, await t.order(id))
  async function receive(id) { await t.press('3'); await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); return t.toast() }
  await t.setTime('2026-11-02T10:00:00+09:00'); log('receive A', await receive(A)); log('receive C', await receive(C))
  await t.setTime('2026-11-09T10:00:00+09:00'); log('receive B (14 日)', await receive(B))
  p = await t.proj(); log('rec', JSON.stringify([A, B, C].map((id) => { const r = p.rows.find((x) => x.id === id); const q = adq(p, id); return [id, r.status, r.orderedAt, r.receivedAt, q.stock, q.leadDays, q.formalLeadDays] })))
  const sc = await page.evaluate(async ([id, S]) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return [sc.receiptStats(p, S), sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).find((x) => x.supplierId === S)?.reasons?.join('・')] }, [otherRow, S])
  log('receiptStats', JSON.stringify(sc))
  check('M5R-1 正式納期 10 日の在庫の行 A（7 日で入荷）は納期内、B（14 日）は遅れ、C（7 日）は納期内 → 2/3', sc[0] && sc[0].ok === 2 && sc[0].total === 3, JSON.stringify(sc))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
