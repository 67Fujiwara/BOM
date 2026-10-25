// ラウンド22: 支給品・社内在庫（見積対象外）に変えた行の status / ボール / ビュー 8（正式見積）の出方。状態ごとに調達区分を変え、normalize 後に ball・status・view8・採用を見る。
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
const statuses = ['draft', 'submitted', 'quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted', 'ordered', 'received']
for (const proc of ['支給品', '社内在庫']) for (const st of statuses) for (const adopted of [false, true]) for (const pub of [false, true]) {
  const ws: any = structuredClone(base); const p = ws.projects[0]
  const r = p.rows.find((x: any) => x.status === (st === 'draft' ? 'quoted' : st)) ?? p.rows[5]
  r.status = st; r.procurement = proc
  r.publishedRev = pub ? 1 : null
  if (adopted) r.adoptedSupplierId = 'S1'; else r.adoptedSupplierId = undefined
  if (['ordered', 'received'].includes(st)) { r.ordered = true; r.received = st === 'received' }
  setSupplierMaster(ws.suppliers); der.setKnownSuppliers(ws.suppliers)
  try { normalize(p, ws) } catch (e: any) { out.push({ proc, st, adopted, pub, error: e.message }); continue }
  const ctx = sel.makeCtx(ws, p, null)
  const views = VIEWS.filter((v: any) => { try { return v.filter(r, ctx) } catch { return false } }).map((v: any) => v.id)
  out.push({ proc, st, adopted, pub, status: r.status, adoptedAfter: r.adoptedSupplierId ?? null, ball: der.ball(p, r), views: views.join(','), hidden: r.hidden })
}
for (const o of out) console.log(JSON.stringify(o))
// 要約: ボールが誰かにある 支給品・社内在庫（status ≠ ordered/received）
const odd = out.filter((o) => !o.error && o.ball && !['ordered', 'received'].includes(o.st))
console.log('ball not null for supplied (non-ordered):', odd.length)
for (const o of odd) console.log('  ', o.proc, o.st, 'adopted=' + o.adopted, 'pub=' + o.pub, '→ status=' + o.status, 'ball=' + o.ball, 'views=' + o.views)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/252-supplied-ball' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
