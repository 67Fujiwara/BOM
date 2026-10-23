import { launch, log } from './lib.mjs'
const t = await launch(); await t.open('design')
const p = await t.proj()
const by = {}
for (const r of p.rows) { const k = r.status + (r.flags && Object.entries(r.flags).filter(([k,v])=>v).map(([k])=>k).join('+') ? '['+Object.entries(r.flags).filter(([k,v])=>v).map(([k])=>k).join('+')+']' : ''); (by[k] ??= []).push(r.id) }
log(JSON.stringify(by, null, 0))
log('members', JSON.stringify(p.members), 'settings', JSON.stringify(p.settings))
log('suppliers', JSON.stringify((await t.ws()).suppliers.map(s=>[s.id,s.name,s.onTimeRate,s.defectRate])))
log('issues', p.issues.map(i=>`${i.id} ${i.rowId} ${i.kind} ${i.status} by ${i.by.role}`).join(' | '))
log('due', p.dueDate, 'subs', p.submissions.length, 'decisions', p.decisions.length, 'caseDecisions', JSON.stringify(p.caseDecisions))
for (const id of ['R001','R002','R003','R013','R023','R040','R050','R060','R070']) { const r = p.rows.find(x=>x.id===id); log(id, r.status, r.name, r.model, r.qtyNeeded, r.unit, r.procurement, r.altPolicy, r.makerLock, 'adopted', r.adoptedSupplierId, 'oq', r.orderQty, 'off', r.needOffset, 'fixed', r.needDateFixed, JSON.stringify(p.quotes.filter(q=>q.rowId===id).map(q=>[q.supplierId,q.unitPrice,q.leadDays,q.moq,q.stock,q.formalPrice,q.formalLeadDays]))) }
await t.close()
