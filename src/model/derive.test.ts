import { describe, expect, it } from 'vitest'
import { handlesMaker, normalizeModel } from './derive'

describe('normalizeModel', () => {
  it('treats full-width punctuation and separators as the same model (§4)', () => {
    expect(normalizeModel('ＭＴ－２．５ 白')).toBe(normalizeModel('MT-2.5 白'))
    expect(normalizeModel('ＡＢ／１５０＿Ｎ')).toBe(normalizeModel('ab/150_n'))
    expect(normalizeModel('S8VK-G12024')).not.toBe(normalizeModel('S8VK-G24024'))
  })
})

describe('handlesMaker', () => {
  it('表記ゆれ・会社の種類・カナと英字・前方一致を同じメーカとみる', () => {
    expect(handlesMaker(['オムロン'], 'OMRON')).toBe(true)
    expect(handlesMaker(['オムロン'], 'omron')).toBe(true)
    expect(handlesMaker(['オムロン'], 'オムロン株式会社')).toBe(true)
    expect(handlesMaker(['三菱電機'], '三菱')).toBe(true)
    expect(handlesMaker(['三菱電機'], 'Mitsubishi Electric Corp.')).toBe(true)
    expect(handlesMaker(['ＩＤＥＣ'], 'idec')).toBe(true)
    expect(handlesMaker(['オムロン'], 'パナソニック')).toBe(false)
    expect(handlesMaker(['オムロン'], '')).toBe(false)
  })
})
