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
})
