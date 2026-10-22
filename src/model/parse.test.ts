import { describe, it, expect } from 'vitest'
import { parseDate, parseNumber } from './parse'

describe('parseNumber', () => {
  const v = (s: string, o = {}) => {
    const r = parseNumber(s, o)
    return r.ok ? r.value : 'ERR'
  }
  it('accepts common Japanese forms', () => {
    expect(v('１２')).toBe(12)
    expect(v('1,200円')).toBe(1200)
    expect(v('¥1200')).toBe(1200)
    expect(v('10個')).toBe(10)
    expect(v('十')).toBe(10)
    expect(v('二十五')).toBe(25)
    expect(v('100万')).toBe(1000000)
    expect(v('1.5')).toBe(1.5)
    expect(v('')).toBe(null)
  })
  it('rejects garbage and out-of-range', () => {
    expect(v('abc')).toBe('ERR')
    expect(v('1e9')).toBe('ERR')
    expect(v('-1', { min: 0 })).toBe('ERR')
    expect(v('2.5', { integer: true })).toBe('ERR')
    expect(v('999999999999', { max: 1e9 })).toBe('ERR')
  })
})

describe('parseDate', () => {
  const v = (s: string) => {
    const r = parseDate(s)
    return r.ok ? r.value : 'ERR'
  }
  it('parses formats', () => {
    expect(v('2026/11/5')).toBe('2026-11-05')
    expect(v('2026-11-05')).toBe('2026-11-05')
    expect(v('20261105')).toBe('2026-11-05')
    expect(v('未定')).toBe(null)
    expect(typeof v('今日')).toBe('string')
  })
  it('rejects invalid dates', () => {
    expect(v('2026/13/45')).toBe('ERR')
    expect(v('2026-2-30')).toBe('ERR')
    expect(v('来月')).toBe('ERR')
  })
})
