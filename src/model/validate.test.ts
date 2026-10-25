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
  it('survives malformed submissions, regex rules, case decisions and row strings (V5-07)', () => {
    const res = sanitizeWorkspace({
      rules: [{ id: 'r', type: 'regex', field: 'model', message: 'x', severity: 'warn', pattern: '([', enabled: true, scope: 'all' }],
      projects: [{ id: 'X', rows: [{ id: 'R001', lastChangeCause: { a: 1 } }], submissions: [{ rev: 1, rowIds: ['R001', 5], causes: { R001: { x: 1 } } }, { rev: 'x' }], caseDecisions: [{ id: 'C1', kind: 5, status: 'open' }] }],
    })
    expect(res.ws!.rules).toHaveLength(0)
    expect(res.ws!.projects[0].rows[0].lastChangeCause).toBeUndefined()
    expect(res.ws!.projects[0].submissions).toHaveLength(1)
    expect(res.ws!.projects[0].submissions[0].rowIds).toEqual(['R001'])
    expect(res.ws!.projects[0].submissions[0].causes).toEqual({})
    expect(res.ws!.projects[0].caseDecisions).toHaveLength(0)
  })
})

describe('ラウンド 17（ベテラン）', () => {
  it('V17-01 文字の印に true・{}・0 が入っていても整えられる', async () => {
    const res = sanitizeWorkspace({
      suppliers: [{ id: 'S1', name: '因幡', tradable: false }, { id: 'S2', name: '立花' }],
      projects: [{ id: 'X', supplierIds: ['S1', 'S2'], rows: [{ id: 'R001', name: 'a', model: 'b', procurement: '相見積', status: 'formalRequested', adoptedSupplierId: 'S1', publishedRev: 1, flags: { formalWithdrawn: true, droppedStopped: {}, surplusRejected: 0, reissue: 'x' } }], quotes: [{ rowId: 'R001', supplierId: 'S1', unitPrice: 10, leadDays: 5, formalRequestNo: 'F1' }] }],
    })
    const r = res.ws!.projects[0].rows[0]
    expect(r.flags).toEqual({})
    const { normalize } = await import('./lifecycle')
    expect(() => normalize(res.ws!.projects[0], res.ws!)).not.toThrow()
  })
  it('V17-02 数千段の入れ子は外して読む', () => {
    let deep: unknown = []
    for (let i = 0; i < 5000; i++) deep = [deep]
    const res = sanitizeWorkspace({ projects: [{ id: 'X', rows: [{ id: 'R001', name: 'a' }], junk: deep }] })
    expect(res.ws).toBeTruthy()
    expect(() => structuredClone(res.ws)).not.toThrow()
    expect(res.warnings?.join()).toContain('入れ子')
  })
  it('V17-11 / V17-12 回答期限の数字は日付として読む、読めない数は知らせる、丸めは範囲の外と言わない', () => {
    const res = sanitizeWorkspace({ projects: [{ id: 'X', rows: [{ id: 'R001', name: 'a' }], settings: { quoteDeadline: '2026-12-01', processDays: 10.6, budget: 'たくさん' } }] })
    const s = res.ws!.projects[0].settings
    expect(s.quoteDeadline).toBe('2026-12-01')
    expect(res.warnings?.join() ?? '').not.toContain('processDays')
    expect(res.warnings?.join() ?? '').toContain('budget')
  })
})
