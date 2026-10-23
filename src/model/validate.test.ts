import { describe, expect, it } from 'vitest'
import { sanitizeWorkspace } from './validate'

describe('sanitizeWorkspace', () => {
  it('coerces wrong value types instead of crashing later', () => {
    const res = sanitizeWorkspace({
      projects: [{ id: 'X', rows: [{ id: 'R001', name: 123, model: { a: 1 }, qtyNeeded: 'abc', status: 'weird', flags: 5 }], issues: [null, { id: 'I1', rowId: 'R001', kind: '質問', status: 'open', by: null }], settings: { processDays: 'x', budget: 'abc' }, weights: { price: 'a' } }],
    })
    expect(res.ws).toBeTruthy()
    const r = res.ws!.projects[0].rows[0]
    expect(r.name).toBe('123')
    expect(r.model).toBe('')
    expect(typeof r.qtyNeeded).toBe('number')
    expect(r.status).toBe('draft')
    expect(res.ws!.projects[0].issues).toHaveLength(1)
    expect(res.ws!.projects[0].issues[0].by.role).toBeTruthy()
    expect(typeof res.ws!.projects[0].settings.processDays).toBe('number')
    expect(res.ws!.projects[0].settings.budget).toBeNull()
    expect(typeof res.ws!.projects[0].weights.price).toBe('number')
  })
  it('drops malformed suppliers, rules, working values and quote fields (V4-08)', () => {
    const res = sanitizeWorkspace({
      suppliers: [null, { id: 'S1', name: { a: 1 } }, { id: 'S2', name: '立花' }],
      rules: [null, { id: 'r1', type: 'required', field: 'name', message: 'x', severity: 'error' }],
      projects: [{ id: 'X', rows: [{ id: 'R001', working: { needDateFixed: 5, category: { a: 1 }, name: 'ok' } }], quotes: [{ rowId: 'R001', supplierId: 'S2', validUntil: 7, stock: { a: 1 }, unitPrice: 10 }] }],
    })
    expect(res.ws!.suppliers.map((x) => x.id)).toEqual(['S2'])
    expect(res.ws!.rules).toHaveLength(1)
    expect(res.ws!.projects[0].rows[0].working).toEqual({ name: 'ok' })
    expect(res.ws!.projects[0].quotes[0]).toMatchObject({ validUntil: null, stock: null, unitPrice: 10 })
  })
})
