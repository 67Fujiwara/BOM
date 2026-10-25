const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { sanitizeWorkspace } = await import(SRC + '/model/validate.ts')
const { normalize } = await import(SRC + '/model/lifecycle.ts')
const { makeWorkspace } = await import(SRC + '/model/sample.ts')
const { setSupplierMaster } = await import(SRC + '/model/rules.ts')
const sel = await import(SRC + '/model/selectors.ts')
const score = await import(SRC + '/model/score.ts')
const { COLUMNS } = await import(SRC + '/model/columns.ts')
const BAD = /NaN|undefined|\[object|Infinity/
const cases: Array<[string, (ws: any) => void]> = [
  ['settings.selector="2026-02-30"', (ws) => { ws.projects[0].settings.selector = '2026-02-30' }],
  ['settings.selector=null', (ws) => { ws.projects[0].settings.selector = null }],
  ['settings.selector={}', (ws) => { ws.projects[0].settings.selector = {} }],
  ['quote.leadDays=1e12', (ws) => { const q = ws.projects[0].quotes.find((x: any) => x.leadDays != null); q.leadDays = 1e12 }],
  ['quote.leadDays=1e308', (ws) => { const q = ws.projects[0].quotes.find((x: any) => x.leadDays != null); q.leadDays = 1e308 }],
  ['row.quotedAt="\\u0000"', (ws) => { const r = ws.projects[0].rows.find((x: any) => x.status === 'quoted'); r.quotedAt = '\u0000' }],
  ['row.quotedAt="abc"', (ws) => { const r = ws.projects[0].rows.find((x: any) => x.status === 'quoted'); r.quotedAt = 'abc' }],
  ['supplier.defectRate="abc"', (ws) => { ws.suppliers[0].defectRate = 'abc' }],
  ['supplier.defectRate={}', (ws) => { ws.suppliers[0].defectRate = {} }],
  ['supplier.defectRate=1e308', (ws) => { ws.suppliers[0].defectRate = 1e308 }],
  ['supplier.defectRate=-1e308', (ws) => { ws.suppliers[0].defectRate = -1e308 }],
  ['supplier.onTimeRate=1e308', (ws) => { ws.suppliers[0].onTimeRate = 1e308 }],
  ['supplier.terms={}', (ws) => { ws.suppliers[0].terms = {} }],
]
for (const [name, mut] of cases) {
  const ws = JSON.parse(JSON.stringify(makeWorkspace()))
  try { mut(ws) } catch (e) { console.log(name, 'mutate failed'); continue }
  const res = sanitizeWorkspace(JSON.parse(JSON.stringify(ws)))
  if (!res.ws) { console.log(name, '-> rejected'); continue }
  setSupplierMaster(res.ws.suppliers)
  const p = res.ws.projects[0]
  normalize(p, res.ws)
  const hits: string[] = []
  for (const role of ['design', 'purchasing', 'pm'] as const) {
    const w = { ...res.ws, user: { ...res.ws.user, role } }
    const ctx = sel.makeCtx(w, p, null)
    for (const r of p.rows) {
      for (const c of COLUMNS.filter((x: any) => !x.perSupplier)) { const tx = sel.cellText(r, c.key, ctx); if (BAD.test(String(tx.text))) { hits.push(`${role}/${r.id}/${c.key}=${String(tx.text).slice(0, 30)}`); break } }
      try { const sc = score.scoreRow(p, r, res.ws.suppliers); if (BAD.test(JSON.stringify(sc))) hits.push(`${role}/${r.id}/scoreRow`) } catch { hits.push('scoreRow throws') }
    }
  }
  console.log(name, '->', hits.length ? hits.slice(0, 3).join(' ; ') + ` (${hits.length})` : 'ok', res.warnings?.length ? '[warn:' + res.warnings.length + ']' : '')
}
