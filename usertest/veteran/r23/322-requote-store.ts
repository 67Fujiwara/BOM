// ラウンド23: 概算の取り直し（requestRoughQuotes）で採用を外すとき、前の採用への対策・追加費用・PM 承認待ち・PM の指摘が取り下げられ、
// Ctrl+Z（undo）で元に戻るか。zustand のストアを Node で直接（localStorage/window を最小限スタブ）。
const mem = new Map<string, string>()
const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
const win: any = { setTimeout, clearTimeout, setInterval, clearInterval, addEventListener() {}, removeEventListener() {}, localStorage: ls, location: { href: 'http://x/' }, dispatchEvent() {}, navigator: { userAgent: 'node' } }
Object.assign(globalThis, { localStorage: ls, window: win, sessionStorage: ls })
;(globalThis as any).document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ click() {}, style: {} }), body: { appendChild() {}, removeChild() {} } }
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { useStore } = await import(SRC + '/model/store.ts')
const Q = await import(SRC + '/actions/quotes.ts')
const st = () => useStore.getState()
const p0 = st().project()
console.log('rows', p0.rows.length, 'suppliers', st().ws.suppliers.map((s: any) => s.id).join(','), 'role', st().ws.user.role)
const row = p0.rows.find((r: any) => r.procurement === '相見積' && !r.hidden) ?? p0.rows[0]
const sid = st().ws.suppliers[0].id
// 状態を作る: 採用あり・納期NG・特急・追加費用・PM 承認待ち・PM の指摘、再見積要
st().commit('test setup', (p: any, ws: any) => {
  const r = p.rows.find((x: any) => x.id === row.id)
  r.status = 'selected'
  r.adoptedSupplierId = sid
  r.flags.requote = true
  r.flags.leadNG = true
  r.flags.countermeasure = '特急'
  r.flags.early = { until: '2026-12-01' }
  r.flags.delegated = true
  r.flags.renegotiating = true
  r.flags.pmPending = process.env.PMPEND === '1'
  r.flags.pmReason = '例外選定'
  r.extraCost = 5000
  r.extraCostKind = '特急'
  p.quotes.push(...(p.quotes.some((q: any) => q.rowId === r.id && q.supplierId === sid) ? [] : [{ rowId: r.id, supplierId: sid, unitPrice: 100, leadDays: 5, stale: false }]))
  p.issues.push({ id: 'ISS-T1', rowId: r.id, kind: '納期NG', status: 'open', by: { role: 'pm', name: 'PM' }, text: 't', createdAt: new Date().toISOString(), field: 'model' })
  p.issues.push({ id: 'ISS-T2', rowId: r.id, kind: '納期NG', status: 'open', by: { role: 'purchasing', name: '購買' }, text: 't2', createdAt: new Date().toISOString(), field: 'model' })
}, { undoable: false })
// 購買にする
st().set({ ws: { ...st().ws, user: { ...st().ws.user, role: 'purchasing', name: '購買 太郎' } } })
const pick = (r: any) => ({ status: r.status, adopted: r.adoptedSupplierId, requote: r.flags.requote, leadNG: r.flags.leadNG, cm: r.flags.countermeasure, early: r.flags.early, delegated: r.flags.delegated, reneg: r.flags.renegotiating, pmPending: r.flags.pmPending, pmReason: r.flags.pmReason, extra: r.extraCost, extraKind: r.extraCostKind })
const iss = () => st().project().issues.filter((i: any) => i.rowId === row.id).map((i: any) => `${i.id}:${i.status}`).join(',')
console.log('before', JSON.stringify(pick(st().project().rows.find((x: any) => x.id === row.id))), iss())
let msg = ''
try { msg = await Q.requestRoughQuotes([sid], '2026-12-31') } catch (e) { msg = 'EXC ' + (e as Error).message.slice(0, 100) }
console.log('result', String(msg).slice(0, 160))
const r1 = st().project().rows.find((x: any) => x.id === row.id)
console.log('after ', JSON.stringify(pick(r1)), iss())
// undo
st().undoLast?.()
const r2 = st().project().rows.find((x: any) => x.id === row.id)
console.log('undone', JSON.stringify(pick(r2)), iss())
const D = await import(SRC + '/model/derive.ts')
const rr = st().project().rows.find((x: any) => x.id === row.id)
console.log('dbg', 'isActive', D.isActive(rr), 'isQuotable', D.isQuotable(rr), 'proc', rr.procurement, 'hidden', rr.hidden, 'status', rr.status, 'supplierIds', st().project().supplierIds.join(','))
