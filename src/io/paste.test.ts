import { describe, it, expect } from 'vitest'
import { parseBomPaste } from './paste'

describe('parseBomPaste', () => {
  it('detects Excel-style headers (品名・形式・メーカー・員数)', () => {
    const r = parseBomPaste('品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t１０\nソケット\tPYF14A\tオムロン\t十')
    expect(r.header).not.toBeNull()
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', maker: 'オムロン', qtyNeeded: 10 })
    expect(r.rows[1].qtyNeeded).toBe(10)
  })
  it('uses default order without header', () => {
    const r = parseBomPaste('制御\tリレー\tMY4N\tオムロン\t4\t個\tKA1')
    expect(r.rows[0]).toMatchObject({ category: '制御', name: 'リレー', model: 'MY4N', qtyNeeded: 4, ref: 'KA1' })
  })
  it('flags unreadable quantities instead of silently using 1', () => {
    const r = parseBomPaste('部品名\t数量\nA\tたくさん\nB\t0')
    expect(r.rows[0].qtyNeeded).toBe(0)
    expect(r.rows[1].qtyNeeded).toBe(0)
    expect(r.warnings.join()).toContain('数量を読めない行が 1 行')
  })
  it('accepts CSV and plain lines', () => {
    expect(parseBomPaste('部品名,型式\n"リレー, 4極",MY4N').rows[0]).toMatchObject({ name: 'リレー, 4極', model: 'MY4N' })
    const plain = parseBomPaste('リレー\nソケット')
    expect(plain.rows.map((r) => r.name)).toEqual(['リレー', 'ソケット'])
    expect(plain.warnings.length).toBe(1)
  })
  it('shifts columns when there is no category and no header', () => {
    const r = parseBomPaste('リレー\tMY4N\tオムロン\t4\nソケット\tPYF14A\tオムロン\t4')
    expect(r.rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', maker: 'オムロン', qtyNeeded: 4 })
    expect(r.warnings.join()).toContain('見出しが無い')
  })
  it('reads English Part header as name', () => {
    const r = parseBomPaste('Part\tModel\tMaker\tQty\nRelay\tMY4N\tOmron\t4')
    expect(r.rows[0]).toMatchObject({ name: 'Relay', model: 'MY4N', maker: 'Omron', qtyNeeded: 4 })
    expect(parseBomPaste('Part No\tQty\nMY4N\t2').rows[0]).toMatchObject({ model: 'MY4N', qtyNeeded: 2 })
  })
})

describe('parseTable', () => {
  it('keeps quoted newlines and delimiters inside one cell', async () => {
    const { parseTable } = await import('./paste')
    expect(parseTable('a\t"1行目\n2行目"\tc\nd\te\tf\n', '\t')).toEqual([['a', '1行目 2行目', 'c'], ['d', 'e', 'f']])
    expect(parseTable('"x, y",2\n"say ""hi""",3', ',')).toEqual([['x, y', '2'], ['say "hi"', '3']])
    expect(parseTable('5"\t6', '\t')).toEqual([['5"', '6']])
  })
})

describe('header search and short tables', () => {
  it('skips title rows above the header', () => {
    const r = parseBomPaste('部品表 第4ライン 制御盤\n\n品名\t形式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t4')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', maker: 'オムロン', qtyNeeded: 4 })
  })
  it('maps 2 and 3 headerless columns from the left', () => {
    expect(parseBomPaste('リレー\t4\nタイマ\t2').rows[0]).toMatchObject({ name: 'リレー', qtyNeeded: 4 })
    expect(parseBomPaste('リレー\tMY4N\t4').rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', qtyNeeded: 4 })
    expect(parseBomPaste('リレー\tMY4N\nタイマ\tH3CR').rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N' })
  })
})
