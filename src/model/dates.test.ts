import { describe, expect, it } from 'vitest'
import { addDays, businessDaysBetween, isHoliday } from './dates'

function naive(from: string, to: string, holidays: string[]): number {
  let n = 0
  let cur = from
  while (cur < to) {
    cur = addDays(cur, 1)
    if (!isHoliday(cur, holidays)) n++
  }
  return n
}

describe('businessDaysBetween', () => {
  it('1 日ずつ数えた結果と同じ', () => {
    const holidays = ['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-14', '2026-05-04', '2026-05-05', '2026-05-05']
    const starts = ['2025-12-27', '2026-01-01', '2026-01-03', '2026-02-10', '2026-04-30']
    for (const from of starts)
      for (let d = 0; d < 60; d++) {
        const to = addDays(from, d)
        expect(businessDaysBetween(from, to, holidays)).toBe(naive(from, to, holidays))
      }
  })
  it('古い日付でもすぐ返る', () => {
    const t = performance.now()
    for (let i = 0; i < 1000; i++) businessDaysBetween('1970-01-01', '2026-10-23')
    expect(performance.now() - t).toBeLessThan(200)
    expect(businessDaysBetween('1970-01-01', '1970-01-08')).toBe(naive('1970-01-01', '1970-01-08', []))
  })
})
