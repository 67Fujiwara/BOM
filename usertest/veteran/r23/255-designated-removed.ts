// ラウンド22: 指定商社の行の指定先が (a) 商社マスタで取引停止 (b) マスタから消えた (c) 名前が一致しない。ball / designatedDeclined / fixedSupplierId / status / ビュー。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster } = await import(SRC + '/model/rules.ts')
const { VIEWS } = await import(SRC + '/model/views.ts')
const sel = await import(SRC + '/model/selectors.ts')
const der = await import(SRC + '/model/derive.ts')
import fs from 'node:fs'
const base = JSON.parse(JSON.stringify(makeWorkspace()))
const out: any[] = []
for (const proc of ['指定商社', '客先指定品']) for (const how of ['stopped', 'removed', 'removedByName', 'unknownName', 'ok']) for (const st of ['submitted', 'quoting', 'quoted', 'selected']) for (const quoteFromGone of [false, true]) {
  const ws: any = structuredClone(base); const p = ws.projects[0]
  const r = p.rows[10]
  r.procurement = proc; r.status = st; r.publishedRev = 1; r.adoptedSupplierId = undefined; r.quoteTargets = undefined
  p.quotes = p.quotes.filter((q: any) => q.rowId !== r.id)
  const S = ws.suppliers.find((s: any) => s.id === 'S3')
  if (proc === '指定商社') r.designated = how === 'removedByName' ? S.name : how === 'unknownName' ? 'ゴースト商事' : 'S3'
  if (quoteFromGone) p.quotes.push({ rowId: r.id, supplierId: 'S3', unitPrice: 100, leadDays: 5, moq: null, stock: '', quoteQty: 1, validUntil: '2027-01-01', note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: '', formalDiffReason: '' })
  if (how === 'stopped') S.tradable = false
  if (how === 'removed' || how === 'removedByName') ws.suppliers = ws.suppliers.filter((s: any) => s.id !== 'S3')
  setSupplierMaster(ws.suppliers); der.setKnownSuppliers(ws.suppliers)
  try { normalize(p, ws) } catch (e: any) { out.push({ proc, how, st, quoteFromGone, error: e.message }); continue }
  const ctx = sel.makeCtx(ws, p, null)
  out.push({ proc, how, st, quoteFromGone, status: r.status, adopted: r.adoptedSupplierId ?? null, fixed: der.fixedSupplierId(p, r, ws.suppliers), declined: der.designatedDeclined(p, r), ball: der.ball(p, r), views: VIEWS.filter((v: any) => { try { return v.filter(r, ctx) } catch { return false } }).map((v: any) => v.id).join(',') })
}
for (const o of out) console.log(JSON.stringify(o))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/255-designated-removed' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
