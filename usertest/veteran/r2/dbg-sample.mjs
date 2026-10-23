import { launch, fresh, proj } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
const p = await proj(page)
const by = {}
for (const r of p.rows) (by[r.status] ??= []).push(r.id + (Object.keys(r.flags).length ? '[' + Object.keys(r.flags).filter(k=>r.flags[k]).join(',') + ']' : '') + (r.adoptedSupplierId ? '*' + r.adoptedSupplierId : '') + (r.working ? 'W' : ''))
console.log(JSON.stringify(by, null, 1))
console.log('issues', p.issues.map((i) => `${i.id}:${i.rowId}:${i.kind}:${i.status}:${i.by.role}`).join(' '))
console.log('members', p.members, 'subs', p.submissions.map(s=>s.rev))
const ball = await page.evaluate(() => [...document.querySelectorAll('[data-testid="row"]')].map((tr) => tr.dataset.rowId + ':' + tr.querySelector('td[data-col="ball"]')?.textContent).filter(x=>!x.endsWith(':設計')).join(' '))
console.log(ball)
await browser.close()
