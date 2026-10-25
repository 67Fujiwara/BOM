const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(SRC + '/model/validate.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster } = await import(SRC + '/model/rules.ts')
const score = await import(SRC + '/model/score.ts')
const run = (dr: unknown) => {
  const ws = JSON.parse(JSON.stringify(makeWorkspace()))
  ws.suppliers.find((s: any) => s.id === 'S1').defectRate = dr
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  setSupplierMaster(res.ws.suppliers)
  const p = res.ws.projects[0]
  let diffRows = 0, nanRows = 0
  const out: string[] = []
  for (const r of p.rows) {
    const rk = score.rankedQuotes(p, r, res.ws.suppliers)
    if (!rk.length) continue
    const top = rk[0]
    out.push(`${r.id}:${(top as any).supplierId ?? (top as any).q?.supplierId}`)
    if (rk.some((x: any) => !Number.isFinite(x.total))) nanRows++
  }
  return { out, nanRows }
}
const a = run(0.005), b = run('abc')
let changed = 0
for (let i = 0; i < a.out.length; i++) if (a.out[i] !== b.out[i]) changed++
console.log('rows with ranking', a.out.length, 'rows with NaN totals', b.nanRows, 'top supplier changed', changed)
