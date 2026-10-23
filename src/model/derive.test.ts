import { describe, expect, it } from 'vitest'
import { normalizeModel } from './derive'

describe('normalizeModel', () => {
  it('treats full-width punctuation and separators as the same model (§4)', () => {
    expect(normalizeModel('ＭＴ－２．５ 白')).toBe(normalizeModel('MT-2.5 白'))
    expect(normalizeModel('ＡＢ／１５０＿Ｎ')).toBe(normalizeModel('ab/150_n'))
    expect(normalizeModel('S8VK-G12024')).not.toBe(normalizeModel('S8VK-G24024'))
  })
})
