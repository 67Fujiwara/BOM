const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster, checkRow } = await import(SRC + '/model/rules.ts')
const { buildProblems } = await import(SRC + '/model/views.ts')
const der = await import(SRC + '/model/derive.ts')
const base = JSON.parse(JSON.stringify(makeWorkspace()))
for (const how of ['stopped', 'removed', 'unknownName', 'ok']) {
  const ws: any = structuredClone(base); const p = ws.projects[0]; const r = p.rows[10]
  r.procurement = '指定商社'; r.status = 'quoting'; r.publishedRev = 1; r.designated = how === 'unknownName' ? 'ゴースト商事' : 'S3'
  p.quotes = p.quotes.filter((q: any) => q.rowId !== r.id)
  if (how === 'stopped') ws.suppliers.find((s: any) => s.id === 'S3').tradable = false
  if (how === 'removed') ws.suppliers = ws.suppliers.filter((s: any) => s.id !== 'S3')
  setSupplierMaster(ws.suppliers); der.setKnownSuppliers(ws.suppliers); normalize(p, ws)
  const pr = ((buildProblems(ws, p) as Map<string, any[]>).get(r.id) ?? [])
  console.log(how, '→', pr.map((x) => `${x.severity}:${x.ruleId}:${String(x.message).slice(0, 70)}`).join(' | ') || '(問題なし)')
}
