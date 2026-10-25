// ラウンド22: 商社マスタから消えた商社の id が、案件の supplierIds / quotes / quoteTargets / designated / adoptedSupplierId / requestRevs / preferredSupplierIds に残る JSON。
// sanitize → setSupplierMaster → normalize → 全ビューの filter・全列の cellText・buildProblems・score・derive 系で例外 / 'undefined' / 'NaN' / '[object' を出す文字が無いか。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(SRC + '/model/validate.ts')
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster } = await import(SRC + '/model/rules.ts')
const { VIEWS, buildProblems } = await import(SRC + '/model/views.ts')
const { COLUMNS } = await import(SRC + '/model/columns.ts')
const sel = await import(SRC + '/model/selectors.ts')
const der = await import(SRC + '/model/derive.ts')
const score = await import(SRC + '/model/score.ts')
import fs from 'node:fs'
const base = JSON.parse(JSON.stringify(makeWorkspace()))
let seed = Number(process.env.SEED ?? 22)
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]
const BAD = /undefined|NaN|\[object|Infinity/
const N = Number(process.env.N ?? 1500)
const sig = new Map<string, { count: number; ex: string }>()
const note = (k: string, ex: string) => { const c = sig.get(k); if (c) c.count++; else sig.set(k, { count: 1, ex }) }
let accepted = 0, rejected = 0
for (let t = 0; t < N; t++) {
  const ws = structuredClone(base)
  const p = ws.projects[0]
  const muts: string[] = []
  // 消す商社（1〜3）
  const gone = [...ws.suppliers].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 3)).map((s: any) => s.id)
  for (let k = 0; k < 1 + Math.floor(rnd() * 6); k++) {
    const r = pick(p.rows) as any, g = pick(gone) as string
    const w = pick(['adopt', 'target', 'designated', 'designatedName', 'fixed', 'quote', 'quoteDecl', 'requestRev', 'pref', 'supplierIds', 'formal', 'cust', 'asked'])
    muts.push(`${w}:${r.id}:${g}`)
    if (w === 'adopt') { r.adoptedSupplierId = g; r.status = pick(['selected', 'formalRequested', 'formalQuoted', 'quoted']) }
    else if (w === 'target') { r.quoteTargets = [...(r.quoteTargets ?? []), g]; r.status = pick(['quoting', 'quoted']) }
    else if (w === 'designated') { r.procurement = '指定商社'; r.designated = g }
    else if (w === 'designatedName') { r.procurement = '指定商社'; r.designated = (ws.suppliers.find((s: any) => s.id === g) ?? { name: 'S9' }).name }
    else if (w === 'fixed') { r.procurement = '客先指定品'; r.adoptedSupplierId = pick([g, null]) }
    else if (w === 'cust') { r.procurement = '客先指定品'; r.status = pick(['quoting', 'quoted', 'selected']); p.quotes.push({ rowId: r.id, supplierId: g, unitPrice: 100, leadDays: 5, moq: null, stock: '', quoteQty: 1, validUntil: '2027-01-01', note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '' }) }
    else if (w === 'quote') { p.quotes.push({ rowId: r.id, supplierId: g, unitPrice: pick([100, 50, null]), leadDays: pick([5, -1, null]), moq: null, stock: '', quoteQty: 1, validUntil: '2027-01-01', note: '', formalPrice: pick([null, 90]), formalLeadDays: null, formalValidUntil: null, formalDiffReason: '' }) }
    else if (w === 'quoteDecl') { p.quotes.push({ rowId: r.id, supplierId: g, unitPrice: null, leadDays: -1, moq: null, stock: '', quoteQty: 1, validUntil: '', note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '' }) }
    else if (w === 'requestRev') { p.requestRevs = { ...(p.requestRevs ?? {}), [g]: { [r.id]: 1 } } }
    else if (w === 'pref') { p.preferredSupplierIds = [...(p.preferredSupplierIds ?? []), g] }
    else if (w === 'supplierIds') { p.supplierIds = [...(p.supplierIds ?? []), g] }
    else if (w === 'formal') { r.status = 'formalRequested'; r.adoptedSupplierId = g; p.quotes.push({ rowId: r.id, supplierId: g, unitPrice: 100, leadDays: 5, moq: null, stock: '', quoteQty: 1, validUntil: '2027-01-01', note: '', formalPrice: pick([null, 80]), formalRequestNo: 'FR-1', formalLeadDays: null, formalValidUntil: null, formalDiffReason: '' }) }
    else if (w === 'asked') { r.status = 'quoting'; p.supplierIds = [...(p.supplierIds ?? []), g]; r.quoteTargets = [g] }
  }
  ws.suppliers = ws.suppliers.filter((s: any) => !gone.includes(s.id))
  if (rnd() < 0.3 && ws.suppliers.length) pick(ws.suppliers as any[]).tradable = false
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  if (!res.ws) { rejected++; continue }
  accepted++
  setSupplierMaster(res.ws.suppliers); der.setKnownSuppliers(res.ws.suppliers)
  for (const p of res.ws.projects) {
    try { normalize(p, res.ws) } catch (e: any) { note('normalize: ' + e.message.slice(0, 100), muts.join(' ')); continue }
    for (const role of ['design', 'purchasing', 'pm'] as const) {
      const w = { ...res.ws, user: { ...res.ws.user, role } }
      let ctx: any
      try { ctx = sel.makeCtx(w, p, null); const pr = buildProblems(w, p); for (const x of pr as any[]) { const s = JSON.stringify(x); if (BAD.test(s)) note('problem text: ' + s.match(BAD)![0], s.slice(0, 160)) } } catch (e: any) { note('makeCtx/buildProblems: ' + e.message.slice(0, 100), muts.join(' ')); continue }
      for (const v of VIEWS) for (const r of p.rows) { try { v.filter(r, ctx) } catch (e: any) { note(`view${v.id}.filter: ` + e.message.slice(0, 100), muts.join(' ')) } }
      for (const r of p.rows) {
        for (const c of COLUMNS.filter((x: any) => !x.perSupplier)) {
          try { const tx = sel.cellText(r, c.key, ctx); sel.cellSev(r, c.key, ctx); if (typeof tx === 'string' && BAD.test(tx)) note(`cellText ${c.key}: ` + tx.match(BAD)![0], `${r.id} ${tx.slice(0, 100)} | ${muts.join(' ')}`) } catch (e: any) { note(`cell.${c.key}: ` + e.message.slice(0, 100), muts.join(' ')) }
        }
        for (const s of res.ws.suppliers) for (const c of COLUMNS.filter((x: any) => x.perSupplier)) { const k = `${c.key}@${s.id}`; try { const tx = sel.cellText(r, k, ctx); if (typeof tx === 'string' && BAD.test(tx)) note(`cellText ${c.key}@S: ` + tx.match(BAD)![0], `${r.id} ${tx}`) } catch (e: any) { note(`cell.${c.key}@S: ` + e.message.slice(0, 100), muts.join(' ')) } }
        try { score.scoreRow(p, r, res.ws.suppliers); score.rankedQuotes(p, r, res.ws.suppliers); score.nextBest(p, r, res.ws.suppliers) } catch (e: any) { note('score: ' + e.message.slice(0, 100), muts.join(' ')) }
        try { der.ball(p, r); der.quoteComplete(p, r); der.quoteResponses(p, r); der.fixedSupplierId(p, r, res.ws.suppliers); der.designatedDeclined(p, r); der.noUsableQuote(p, r); der.lineAmount(p, r) } catch (e: any) { note('derive.row: ' + e.message.slice(0, 100), muts.join(' ')) }
      }
      try { der.totals(p); der.ballCounts(p); der.designBreakdown(p) } catch (e: any) { note('derive.project: ' + e.message.slice(0, 100), muts.join(' ')) }
    }
    // normalize 後に消えた商社の id が採用に残るか
    for (const r of p.rows as any[]) if (r.adoptedSupplierId && !res.ws.suppliers.some((s: any) => s.id === r.adoptedSupplierId) && !['ordered', 'received', 'cancelled'].includes(r.status)) note('adopted-removed-after-normalize status=' + r.status, `${r.id} ${r.adoptedSupplierId}`)
  }
}
const out = { src: SRC, N, accepted, rejected, distinct: [...sig.entries()].map(([k, v]) => ({ k, count: v.count, ex: v.ex })) }
console.log(JSON.stringify(out, null, 1).slice(0, 6000))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/231-removed-supplier' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
