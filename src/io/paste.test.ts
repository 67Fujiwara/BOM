import { describe, it, expect } from 'vitest'
import { parseBomPaste, xlsxToTsv } from './paste'

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

describe('合計・区切りの行（表記ゆれ）', () => {
  it('「合　計」「小 計」「合計（税抜）」「総合計」「以下余白」「■ 制御部」を飛ばす', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\n■ 制御部\t\t\t\nリレー\tMY4N\tオムロン\t2\n\t\t合　計\t2\n\t\t小 計\t2\n\t\t合計（税抜）\t9\n\t\t総合計\t9\n以下余白\t\t\t')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N'])
  })
  it('1 列だけの貼り付けでは、記号で始まる値を区切りとみなさない', () => {
    const r = parseBomPaste('型式\n【A】CN-12\nMY4N')
    expect(r.rows.length).toBe(2)
  })
})

describe('xlsxToTsv', () => {
  it('途中の空のセルで右の値がずれない。隠した列は外す', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('BOM')
    ws.addRow(['部品名', '旧型式', '型式', 'メーカ', '備考', '数量'])
    ws.addRow(['リレー', 'MY2N-OLD', 'MY4N', 'オムロン', null, 4])
    ws.addRow(['タイマ', null, 'H3CR', null, null, 3])
    ws.getColumn(2).hidden = true
    const buf = await wb.xlsx.writeBuffer()
    const tsv = await xlsxToTsv(buf as ArrayBuffer)
    const lines = tsv.split('\n').map((l) => l.split('\t'))
    expect(lines[1]).toEqual(['リレー', 'MY4N', 'オムロン', '', '4'])
    expect(lines[2]).toEqual(['タイマ', 'H3CR', '', '', '3'])
    const r = parseBomPaste(tsv)
    expect(r.rows.map((x) => [x.model, x.maker, x.qtyNeeded])).toEqual([['MY4N', 'オムロン', 4], ['H3CR', '', 3]])
  })
})

describe('合計・区切りの行（ラウンド 9 の表記）', () => {
  it('飾り・数・単位つきの合計、<端子部>・1. 制御部・右が空の区切りを飛ばす', () => {
    const r = parseBomPaste('No\t部品名\t型式\tメーカ\t数量\n【電源部】\n1\tリレー\tMY4N\tオムロン\t2\n\t計：6個\t\t\t\n\t【合計】\t\t\t6\n\t＜合計＞\t\t\t6\n\t合計 6点\n\t＊合計＊\t\t\t6\n\t-- 以下余白 --\n\t合計数量 6\n1. 制御部\n<端子部>\n2\tヒューズ\tF-1.5A\tサトー\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'F-1.5A'])
  })
})

describe('ラウンド 10 の取り込み', () => {
  it('型式（旧）/型式（新）では新しい列を使う', () => {
    const r = parseBomPaste('部品名\t型式（旧）\t型式（新）\t数量(old)\t数量\nリレー\tMY2N\tMY4N-D2\t2\t4')
    expect(r.rows[0].model).toBe('MY4N-D2')
    expect(r.rows[0].qtyNeeded).toBe(4)
  })
  it('ページごとに繰り返した見出しで前のページを捨てない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n部品名\t型式\t数量\nタイマ\tH3CR\t1\n部品名\t型式\t数量\nヒューズ\tF1\t3')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'H3CR', 'F1'])
  })
  it('※以下余白・＝＝＝＝・合計金額 ¥12,000・総数・部品点数 3 を飛ばす', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n＝＝＝＝\t\t\n合計金額 ¥12,000\t\t\n総数\t\t6\n部品点数 3\t\t\n※以下余白\t\t')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N'])
  })
})

describe('隠した列（ほかに同じ項目の列が無い）', () => {
  it('数量の列だけを隠していても数量を読む', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('BOM')
    ws.addRow(['部品名', '型式', '数量'])
    ws.addRow(['リレー', 'MY4N', 4])
    ws.getColumn(3).hidden = true
    const tsv = await xlsxToTsv((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(parseBomPaste(tsv).rows[0].qtyNeeded).toBe(4)
  })
})

describe('ラウンド 11 の取り込み', () => {
  it('型式 旧・型式_旧・型式【旧】・型式[旧]・現型式／新型式・型式（旧品）では新しい列', () => {
    for (const [a, b] of [['型式 旧', '型式 新'], ['型式_旧', '型式_新'], ['型式【旧】', '型式【新】'], ['型式[旧]', '型式[新]'], ['現型式', '新型式'], ['型式（旧品）', '型式（新品）']]) {
      const r = parseBomPaste(`部品名\t${a}\t${b}\t数量\nリレー\tMY2N\tMY4N-D2\t4`)
      expect([a, r.rows[0].model]).toEqual([a, 'MY4N-D2'])
    }
  })
  it('2 ページ目の見出しが少し違っても前のページを捨てない', () => {
    const r = parseBomPaste('No\t品名\t型式\t数量\n1\tリレー\tMY4N\t2\n\t品名（続き）\t型式\t数量\n2\tタイマ\tH3CR\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'H3CR'])
  })
  it('総数量・員数合計・数量計・合計 6 個 ¥12,000・以下余白です、使う列が空の行を飛ばす', () => {
    const r = parseBomPaste('部品名\t型式\t数量\t\nリレー\tMY4N\t2\t\n総数量\t\t6\t\n員数合計\t\t6\t\n数量計\t\t6\t\n合計 6 個 ¥12,000\t\t\t\n以下余白です\t\t\t\n\t\t\tページ 1/2')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N'])
  })
})
