const { makeWorkspace } = await import('/home/user/BOM/src/model/sample.ts')
const ws: any = makeWorkspace()
console.log(Object.keys(ws), ws.suppliers.map((s: any) => s.id + ':' + s.name + ':' + s.tradable), ws.projects.length)
const p = ws.projects[0]
console.log(Object.keys(p))
console.log('supplierIds', p.supplierIds, 'pref', p.preferredSupplierIds, 'requestRevs', JSON.stringify(p.requestRevs)?.slice(0, 200), 'rows', p.rows.length, 'quotes', p.quotes.length)
console.log(JSON.stringify(p.rows[0]).slice(0, 800))
console.log(p.rows.map((r: any) => r.status + '/' + r.procurement).join(' '))
console.log(JSON.stringify(p.quotes[0]))
