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

describe('round 4 import cases', () => {
  it('prefers the real header over a title block and reads part-number headers as model', () => {
    const r = parseBomPaste('品名\t制御盤\t図番\tD-001\n\nDesignator\tDescription\tManufacturer\tManufacturer Part Number\tQty\nK1\tRelay\tOmron\tMY4N\t2')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ ref: 'K1', name: 'Relay', maker: 'Omron', model: 'MY4N', qtyNeeded: 2 })
  })
  it('handles quantity in the first column and units on the quantity', () => {
    expect(parseBomPaste('4\tリレー\tMY4N\n2\tタイマ\tH3CR').rows[0]).toMatchObject({ qtyNeeded: 4, name: 'リレー', model: 'MY4N' })
    expect(parseBomPaste('部品名\t数量\nケーブル\t20 m').rows[0]).toMatchObject({ qtyNeeded: 20, unit: 'm' })
  })
})

describe('round 5 import cases', () => {
  it('reads 使用数 / Q\'ty, メーカー型式, title block with equal words, totals and item numbers', () => {
    const r = parseBomPaste("品名\t制御盤\t型式\tX-1\nItem\t品名\tメーカー型式\tメーカー\t使用数\n1\tリレー\tMY4N\tオムロン\t2\n2\tタイマ\tH3CR\tオムロン\t1袋\n\t\t\t合計\t3")
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', maker: 'オムロン', qtyNeeded: 2 })
    expect(r.rows[1].qtyNeeded).toBe(1)
    expect(parseBomPaste("Part\tQ'ty\nRelay\t4").rows[0]).toMatchObject({ name: 'Relay', qtyNeeded: 4 })
  })
})

describe('合計の行', () => {
  it('ラベルが品名以外の列にある「合計金額」も飛ばす', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t2\n\t\t合計金額\t12000\n\t\tGrand Total:\t3')
    expect(r.rows.length).toBe(1)
  })
})
