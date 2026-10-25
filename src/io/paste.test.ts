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

describe('ラウンド 11（ベテラン）の取り込み', () => {
  it('ページの見出しが少し違っても（P.1・員数／数量）前のページを捨てない、ページの表題を部品にしない', () => {
    const r = parseBomPaste('部品表 (1/2)\t\t\t\nNo\t品名\t型式\t員数\n1\tリレー\tMY4N\t2\n部品表 (2/2)\t\t\t\nP.2\t品名\t型式\t数量\n2\tタイマ\tH3CR\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'H3CR'])
  })
  it('隠した数量の列は、表題の「台数 2台」があっても読む', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('BOM')
    ws.addRow([null, null, '台数 2台'])
    ws.addRow(['部品名', '型式', '数量'])
    ws.addRow(['リレー', 'MY4N', 12])
    ws.getColumn(3).hidden = true
    const tsv = await xlsxToTsv((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(parseBomPaste(tsv).rows.map((x) => x.qtyNeeded)).toEqual([12])
  })
})

describe('ラウンド 12 の取り込み', () => {
  it('型式も数量も旧／新がある表では、どちらも新しい列', () => {
    const r = parseBomPaste('部品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\t2\t4')
    expect([r.rows[0].model, r.rows[0].qtyNeeded]).toEqual(['MY4N-D2', 4])
  })
  it('使用個数・手配数量・必要個数・現数量／新数量も数量', () => {
    for (const h of ['使用個数', '手配数量', '必要個数']) expect(parseBomPaste(`部品名\t型式\t${h}\nリレー\tMY4N\t7`).rows[0].qtyNeeded).toBe(7)
    expect(parseBomPaste('部品名\t型式\t現数量\t新数量\nリレー\tMY4N\t2\t5').rows[0].qtyNeeded).toBe(5)
  })
  it('現行型式／変更型式・型式(現)／(改) では変更後', () => {
    expect(parseBomPaste('部品名\t現行型式\t変更型式\t数量\nリレー\tMY2N\tMY4N-D2\t1').rows[0].model).toBe('MY4N-D2')
    expect(parseBomPaste('部品名\t型式(現)\t型式(改)\t数量\nリレー\tMY2N\tMY4N-D2\t1').rows[0].model).toBe('MY4N-D2')
  })
  it('2 段の見出し（型式・数量の下に 旧／新）は新しい列を読み、下の段を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t\t数量\t\n\t旧\t新\t旧\t新\nリレー\tMY2N\tMY4N-D2\t2\t4')
    expect(r.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['MY4N-D2', 4]])
  })
  it('- 1 -・Page 1 of 2・（次頁へ続く）・※注記・以上、2点・（合計）を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n- 1 -\t\t\nPage 1 of 2\t\t\n（次頁へ続く）\t\t\n※ 端子は別途\t\t\nタイマ\tH3CR\t1\n以上、2点\t\t\n（合計）\t\t3')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'H3CR'])
  })
})

describe('ラウンド 12（ベテラン）の取り込み', () => {
  it('名称未定・型式未定・メーカ未定の行を見出しの繰り返しにしない', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t2\n名称未定\t型式未定\tメーカ未定\t1\n部品取付板\t品番未定\t\t1\nタイマ\tH3CR\tオムロン\t1')
    expect(r.rows.length).toBe(4)
  })
  it('表題の「品名：…」「数量：…」を見出しにしない', () => {
    const r = parseBomPaste('品名：制御盤\t\t数量：1台\n部品名\t型式\t数量\nリレー\tMY4N\t2')
    expect(r.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['MY4N', 2]])
  })
  it('2 ページ目の見出しの列の並びが違っても、正しい項目に入れる', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t2\nNo\t部品名\t型式\t数量\tメーカ\n2\tタイマ\tH3CR\t1\tオムロン')
    expect(r.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 'オムロン', 2], ['タイマ', 'H3CR', 'オムロン', 1]])
  })
  it('部品表ホルダー・BOM ラベルは部品、部品表 (2/3) と P.2 だけの行は飛ばす', () => {
    const r = parseBomPaste('部品名\t型式\t数量\n部品表ホルダー\t\t\nBOM ラベル\t\t\n部品表 (2/3)\t\tP.2\nリレー\tMY4N\t2')
    expect(r.rows.map((x) => x.name)).toEqual(['部品表ホルダー', 'BOM ラベル', 'リレー'])
  })
})

describe('ラウンド 13 の取り込み', () => {
  it('字の間に空白のある見出し（品 名・メ ー カ・数　量）', () => {
    const r = parseBomPaste('品 名\t型 式\tメ ー カ\t数　量\nリレー\tMY4N-D2\tオムロン\t4')
    expect([r.rows[0].name, r.rows[0].model, r.rows[0].maker, r.rows[0].qtyNeeded]).toEqual(['リレー', 'MY4N-D2', 'オムロン', 4])
  })
  it('上の段がまとめの名前（部品情報｜数量）、下の段が 品名…旧｜新 の 2 段の見出し', () => {
    const r = parseBomPaste('部品情報\t\t\t数量\t\n品名\t型式\tメーカー\t旧\t新\nリレー\tMY4N\tオムロン\t2\t4')
    expect(r.rows[0].qtyNeeded).toBe(4)
  })
  it('修正前/後・改定前/後・改正前/後・訂正前/後・差替前/後・現状/変更案・Rev.A/B は新しい列', () => {
    for (const [a, b] of [['型式（修正前）', '型式（修正後）'], ['改定前型式', '改定後型式'], ['型式 改正前', '型式 改正後'], ['訂正前型式', '訂正後型式'], ['型式（差替前）', '型式（差替後）'], ['型式（現状）', '型式（変更案）'], ['型式 Rev.A', '型式 Rev.B']]) {
      const r = parseBomPaste(`部品名\t${a}\t${b}\t数量\nリレー\tMY2N\tMY4N-D2\t4`)
      expect([a, r.rows[0].model]).toEqual([a, 'MY4N-D2'])
    }
  })
  it('新品番・旧品番・新品名は品番・品名', () => {
    const r = parseBomPaste('新品名\t旧品番\t新品番\t数量\nリレー\tMY2N\tMY4N-D2\t4')
    expect([r.rows[0].name, r.rows[0].model]).toEqual(['リレー', 'MY4N-D2'])
  })
  it('要数・所要量・使用量・必要量は数量。数量の列が無ければ知らせる', () => {
    for (const h of ['要数', '所要量', '使用量', '必要量']) expect(parseBomPaste(`部品名\t型式\t${h}\nリレー\tMY4N\t7`).rows[0].qtyNeeded).toBe(7)
    expect(parseBomPaste('部品名\t型式\nリレー\tMY4N').warnings.join()).toContain('数量')
  })
  it('－２－・P1/3・以下次頁・次頁につづく・合計 6台分・計 ６・合計：6個 / ¥12,000 を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n－２－\t\t\nP1/3\t\t\n以下次頁\t\t\n次頁につづく\t\t\n合計 6台分\t\t\n計 ６\t\t\n合計：6個 / ¥12,000\t\t')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N'])
  })
})

describe('ラウンド 13 の取り込み（ベテラン）', () => {
  it('「部品取付板 / 品番なし / メーカ不問」の行を見出しにせず、後ろの数量を消さない', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t員数\nリレー\tMY4N\tオムロン\t12\n部品取付板\t品番なし\tメーカ不問\t1\n結束バンド\t型式なし\tメーカー支給\t50\n端子台\tXW2B\tオムロン\t2')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([12, 1, 50, 2])
    const s = parseBomPaste('部品名\t型式\t数量\n部品名シール\t品番なし\t2\nA\tX1\t1\nB\tX2\t2')
    expect(s.rows.map((x) => x.qtyNeeded)).toEqual([2, 1, 2])
  })
  it('旧／新の列のある見出しをページごとに繰り返しても、どのページも新の列', () => {
    const page = (i: number) => `部品名\t型式(旧)\t型式(新)\t数量(旧)\t数量(新)\nリレー${i}\tOLD-${i}\tNEW-${i}\t${i}\t${i + 10}`
    const r = parseBomPaste([page(0), page(1), page(2)].join('\n'))
    expect(r.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['NEW-0', 10], ['NEW-1', 11], ['NEW-2', 12]])
    expect(r.warnings.join()).not.toContain('並びに直しました')
  })
  it('見出しらしくない見出しの列も、ページの並びが違えば元の見出しの文字で並べ直す', () => {
    const r = parseBomPaste('部品名\tメーカ\tManufacturer Part Number (MPN)\t数量(10台分)\nA\tM\tX1\t3\n数量(10台分)\t部品名\tメーカ\tManufacturer Part Number (MPN)\n2\tB\tM\tX2')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['A', 'X1', 3], ['B', 'X2', 2]])
  })
  it('縦に結合した部品名と、型式・数量の下の旧／新の 2 段の見出し（ページごとの繰り返しも）', () => {
    const head = '部品名\t型式\t\t数量\t\n部品名\t旧\t新\t旧\t新'
    const r = parseBomPaste(`${head}\nリレー\tMY2N\tMY4N\t10\t12\n${head}\n端子台\tXW2A\tXW2B\t1\t2`)
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 12], ['端子台', 'XW2B', 2]])
  })
  it('変更後の列が空の行は、元の列の値を使って知らせる', () => {
    const r = parseBomPaste('部品名\t型式\t数量\t変更後数量\nリレー\tMY4N\t10\t12\n端子台\tXW2B\t2\t\nヒューズ\tF-10\t4\t')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([12, 2, 4])
    expect(r.warnings.join()).toContain('空の 2 行')
    const m = parseBomPaste('部品名\t型式\t新型式\t数量\nリレー\tMY2N\tMY4N\t1\n端子台\tXW2B\t\t1')
    expect(m.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
  })
  it('Newark P/N・新光品番は版の印ではない（メーカの型番を型式に）', () => {
    expect(parseBomPaste('Description\tMfr P/N\tNewark P/N\tManufacturer\tQty\nRelay\tMY4N\t12AB345\tOmron\t2').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\tメーカ型番\t新光品番\tメーカ\t数量\nリレー\tMY4N\tSK-001\tオムロン\t2').rows[0].model).toBe('MY4N')
  })
  it('ページの表題の書き方の違い（その2・2 of 3・Page 2・続き・全角）を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n部品表 その2\t\t\nBOM (2 of 3)\t\t\n部品リスト Page 2\t\t\n部品表(続き)\t\t\n部品表（２／３）\tＰ．２\t\n部品表 (2/2)\t制御盤A\tP.2\n端子台\tXW2B\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
  })
})

describe('ラウンド 13 の取り込み（表題欄）', () => {
  it('ラベルと値が別のセルの表題欄（品名 | 制御盤A | 数量 | 2）を見出しにしない', () => {
    const r = parseBomPaste('品名\t制御盤A\t数量\t2\n\n部品名\t型式\t数量\nリレー\tMY4N\t4\n端子台\tXW2B\t2')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 4], ['端子台', 'XW2B', 2]])
    const s = parseBomPaste('品名\t制御盤A\t\t\n部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t4')
    expect(s.rows.map((x) => [x.model, x.maker, x.qtyNeeded])).toEqual([['MY4N', 'オムロン', 4]])
  })
})

describe('ラウンド 14 の取り込み（新人）', () => {
  it('変更図の削除の行（新の列が空・備考に削除、追加の行がある表）は取り込まない', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\t備考\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t4\t変更\nタイマ\tH3Y-2\t\tオムロン\t1\t\t削除\n端子台\t\tXW2B-20G4\tオムロン\t\t2\t追加')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N-D2', 4], ['端子台', 'XW2B-20G4', 2]])
    expect(r.warnings[0]).toContain('削除された部品')
  })
  it('〃・同上は上の行、同左は左のセルの値', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nリレー\tMY2N-D2\t〃\t2\nタイマ\tH3CR-A8\t同上\t1\n〃\tH3CR-A8N\t〃\t1')
    expect(r.rows.map((x) => [x.name, x.maker])).toEqual([['リレー', 'オムロン'], ['リレー', 'オムロン'], ['タイマ', 'オムロン'], ['タイマ', 'オムロン']])
    expect(r.warnings.join()).toContain('〃')
  })
  it('表題欄「品名｜第4ライン制御盤｜型式｜CP-4L｜数量｜1台｜備考｜客先」を見出しにしない', () => {
    const r = parseBomPaste('品名\t第4ライン制御盤\t型式\tCP-4L\t数量\t1台\t備考\t客先 ABC\n作成\t山田\t承認\t田中\n\nNo\t品名\t形式\tメーカー\t員数\n1\tリレー\tMY4N-D2 DC24\tオムロン\t4\n2\tタイマ\tH3CR-A8\tオムロン\t2')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N-D2 DC24', 4], ['タイマ', 'H3CR-A8', 2]])
  })
  it('以下次葉・製品名つきのページの表題・部品点数合計・合計 6 ヶ・以上 2 品目を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n-以下次葉-\t\t\n制御盤A 部品表 2/2\t\t\n部品点数合計 2\t\t\n合計 6 ヶ\t\t\n以上 2 品目\t\t\n端子台\tXW2B\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
  })
})

describe('ラウンド 14 の xlsx（新人）', () => {
  it('縦に結合したデータのセル（分類・メーカ）は各行に値、横に結合した見出しは左上だけ', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('BOM')
    ws.addRows([['分類', '品名', '型式', '', 'メーカー', '数量'], ['制御', 'リレー', 'MY4N', '', 'オムロン', 2], ['', 'タイマ', 'H3CR', '', '', 1], ['', 'リレー', 'MY2N', '', '', 3]])
    ws.mergeCells('C1:D1')
    ws.mergeCells('A2:A4')
    ws.mergeCells('E2:E4')
    const tsv = await xlsxToTsv((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    const r = parseBomPaste(tsv)
    expect(r.rows.map((x) => [x.category, x.name, x.maker])).toEqual([['制御', 'リレー', 'オムロン'], ['制御', 'タイマ', 'オムロン'], ['制御', 'リレー', 'オムロン']])
  })
})

describe('ラウンド 14 の取り込み（ベテラン）', () => {
  it('ページの見出しに列が足りないページも、ある列だけ並べ直す（無い列は空）', () => {
    const a = parseBomPaste('部品名\t型式\tメーカ\t員数\nリレー\tMY4N\tオムロン\t4\n部品名\t型式\t員数\n端子台\tXW2B\t2\nヒューズ\tF-10\t4')
    expect(a.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 'オムロン', 4], ['端子台', 'XW2B', '', 2], ['ヒューズ', 'F-10', '', 4]])
    const b = parseBomPaste('回路記号\t部品名\t型式\t数量\nKA1\tリレー\tMY4N\t4\n部品名\t型式\t数量\n端子台\tXW2B\t2')
    expect(b.rows.map((x) => [x.ref, x.name, x.model, x.qtyNeeded])).toEqual([['KA1', 'リレー', 'MY4N', 4], ['', '端子台', 'XW2B', 2]])
  })
  it('変更後の型式・変更前の数量／変更後の数量・新しい型式・Prev. P/N・新台数・新図番', () => {
    expect(parseBomPaste('部品名\t現在の型式\t変更後の型式\t数量\nリレー\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\t型式\t変更前の数量\t変更後の数量\nリレー\tMY4N\t10\t12').rows[0].qtyNeeded).toBe(12)
    expect(parseBomPaste('部品名\t今の型式\t新しい型式\t数量\nリレー\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('Description\tPrev. P/N\tP/N\tQty\nRelay\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\t型式\t旧台数\t新台数\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(3)
    expect(parseBomPaste('部品名\t型式\t旧図番\t新図番\t数量\nリレー\tMY4N\tD-100\tD-200\t1').rows[0].drawing).toBe('D-200')
  })
  it('上の段に変更前／変更後、下の段に項目を繰り返す様式は変更後を読む（部品名は上の段だけでも）', () => {
    const a = parseBomPaste('\t変更前\t\t\t変更後\t\t\n部品名\t型式\tメーカ\t数量\t型式\tメーカ\t数量\nリレー\tMY2N\tオムロン\t10\tMY4N\tオムロン\t12')
    expect(a.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 12]])
    const b = parseBomPaste('部品名\t旧\t\t新\t\n\t型式\t数量\t型式\t数量\nリレー\tMY2N\t10\tMY4N\t12')
    expect(b.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 12]])
  })
  it('2/3 ページ・2/3頁・ページ 2/3・2ページ目・第2頁・Sheet 2 を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n2/3 ページ\t\t\n2/3頁\t\t\nページ 2/3\t\t\n2ページ目\t\t\n第2頁\t\t\nSheet 2\t\t\n端子台\tXW2B\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
  })
  it('2 段の見出しの下の段に単位の注記・Rev.A／B・印が 1 つだけでも 1 段にまとめる', () => {
    const a = parseBomPaste('部品名\t型式\t\t数量\t\t単位\n\t旧\t新\t旧\t新\t(個)\nリレー\tMY2N\tMY4N\t10\t12\t個')
    expect(a.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['MY4N', 12]])
    const b = parseBomPaste('部品名\t型式\t\t数量\n\tRev.A\tRev.B\t\nリレー\tMY2N\tMY4N\t3')
    expect(b.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['MY4N', 3]])
  })
  it('新の列の －・同左・変更なし は変えていない（〃 は上の行と同じ）、削除・廃止は取り込まない', () => {
    const r = parseBomPaste('部品名\t型式\t新型式\t数量\t新数量\nリレー\tMY2N\tMY4N\t1\t2\n端子台\tXW2B\t－\t3\t〃\nヒューズ\tF-10\t変更なし\t4\t同左\nタイマ\tH3Y\t削除\t1\t削除')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 2], ['端子台', 'XW2B', 2], ['ヒューズ', 'F-10', 4]])
  })
  it('ページの見出しの旧／新の並びが違っても新の列、見出しの語だけの銘板の行は見出しにしない', () => {
    const a = parseBomPaste('部品名\t型式(旧)\t型式(新)\t数量\nリレー\tMY2N\tMY4N\t1\n部品名\t新型式\t旧型式\t数量\n端子台\tXW2B\tXW2A\t2')
    expect(a.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
    const b = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t1\n部品名\t型式(旧)\t型式(新)\t数量\n端子台\tXW2A\tXW2B\t2')
    expect(b.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
    const c = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t1\n型式表示板\t部品名札\tメーカ銘板\t数量表示ラベル\n端子台\tXW2B\tオムロン\t2')
    expect(c.rows.at(-1)).toMatchObject({ name: '端子台', model: 'XW2B' })
  })
})

describe('ラウンド 14 のページの表題（ベテラン）', () => {
  it('部品構成表 (2/3)・購入品リスト 2/3・部品明細表 P.2・材料表 (3/3)・部品表 (2/3) 制御盤A・部品表 Rev.B (2/3)・BOM - Page 2 of 3', () => {
    const r = parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t2\n部品構成表 (2/3)\t\t\n購入品リスト 2/3\t\t\n部品明細表 P.2\t\t\n材料表 (3/3)\t\t\n部品表 (2/3) 制御盤A\t\t\n部品表 Rev.B (2/3)\t\t\nBOM - Page 2 of 3\t\t\n端子台\tXW2B\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'XW2B'])
  })
  it('項目以外の列が多い見出しの上の表題欄（数量 2台）を見出しにしない', () => {
    const r = parseBomPaste('品名\t制御盤A\t型式\tCP-100\t数量\t2台\tメーカ\t自社\n\nNo\t品名\t型式\tメーカ\t数量\t単位\t単価\t金額\t納期\t購入先\t手配区分\t仕様\t備考\n1\tケーブル\tVCTF 2C\t富士\t20\tm\t100\t2000\t5\tA\t購入\t-\t\n')
    expect(r.rows.map((x) => [x.name, x.qtyNeeded, x.unit])).toEqual([['ケーブル', 20, 'm']])
  })
})

describe('ラウンド 15 の取り込み（新人）', () => {
  it('見積書の形の見出し（品名｜規格｜メーカー｜単価｜数量｜金額）を表題欄にしない', () => {
    const r = parseBomPaste('品名\t規格\tメーカー\t単価\t数量\t金額\nリレー\tMY4N\tオムロン\t1200\t4\t4800')
    expect(r.header).not.toBeNull()
    expect(r.rows.map((x) => [x.name, x.maker, x.qtyNeeded])).toEqual([['リレー', 'オムロン', 4]])
  })
  it('変えた行だけ変更後を書く表に追加の行があっても、変えていない行を消さない', () => {
    const r = parseBomPaste('品名\t型式\t変更後型式\t数量\nリレー\tMY2N\tMY4N\t2\n端子台\tXW2B\t\t3\nタイマ\t\tH3CR\t1')
    expect(r.rows.map((x) => [x.name, x.model])).toEqual([['リレー', 'MY4N'], ['端子台', 'XW2B'], ['タイマ', 'H3CR']])
  })
  it('変更記号・変更備考は回路記号・備考にしない', () => {
    const r = parseBomPaste('変更記号\t回路記号\t品名\t型式\t数量\t備考\t変更備考\n△1\tK1\tリレー\tMY4N\t2\t予備\t型式変更')
    expect(r.rows[0]).toMatchObject({ ref: 'K1', note: '予備' })
  })
  it('数量を 1号機・2号機・合計 に分けた 2 段の見出し（品名などは縦に結合）は合計の列', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\t\t\n品名\t型式\tメーカー\t1号機\t2号機\t合計\nリレー\tMY4N\tオムロン\t2\t3\t5')
    expect(r.rows.map((x) => [x.name, x.qtyNeeded])).toEqual([['リレー', 5]])
  })
  it('メーカーの列の同左は型式を写さない（上の行の値）、″・同　上・上に同じ も上の行', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\nリレー\tMY4N\tオムロン\t1\nソケット\tPYF08A\t同左\t1\nタイマ\tH3CR\t″\t1\nヒューズ\tF-10\t同　上\t1\n端子\tXW2B\t上に同じ\t1')
    expect(r.rows.map((x) => x.maker)).toEqual(['オムロン', 'オムロン', 'オムロン', 'オムロン', 'オムロン'])
  })
  it('新の列の撤去・不要・× は削除', () => {
    const r = parseBomPaste('部品名\t型式\t新型式\t数量\t新数量\nリレー\tMY2N\tMY4N\t1\t2\nタイマ\tH3Y\t撤去\t1\t\n端子\tXW2A\t×\t1\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
})

describe('ラウンド 15 の取り込み（ベテラン）', () => {
  it('品名・仕様・数量・単価・金額、No・部品名・仕様・型式・単価・数量・金額、Spec/Price の見出しを表題欄にしない', () => {
    for (const h of ['品名\t仕様\t数量\t単価\t金額', 'No\t部品名\t仕様\t型式\t単価\t数量\t金額', 'Description\tSpec\tQty\tPrice\tAmount']) {
      const r = parseBomPaste(`${h}\n${h.startsWith('No') ? '1\tリレー\t4極\tMY4N\t1200\t4\t4800' : 'リレー\t4極\t4\t1200\t4800'}`)
      expect([h, r.rows[0].qtyNeeded]).toEqual([h, 4])
    }
  })
  it('設計変更の様式の上の段（変更前｜変更後）をページごとに繰り返しても部品にしない', () => {
    const page = '\t変更前\t\t変更後\t\n部品名\t型式\t数量\t型式\t数量'
    const r = parseBomPaste(`${page}\nリレー\tMY2N\t1\tMY4N\t2\n${page}\n端子台\tXW2A\t1\tXW2B\t3`)
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 2], ['端子台', 'XW2B', 3]])
  })
  it('2 ページ目の見出しの言い方が違っても（品名・形式・メーカー・員数）見出しとして外す', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t1\n品名\t形式\tメーカー\t員数\n端子台\tXW2B\tオムロン\t2')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('「計」と長い数字のセルでも止まらない', () => {
    const t0 = Date.now()
    parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t1\n計' + '1'.repeat(40) + 'x\t\t')
    expect(Date.now() - t0).toBeLessThan(500)
  })
})

describe('ラウンド 15 の xlsx（ベテラン）', () => {
  it('「"」だけのセルで後ろの行がつながらない、2 行にまたがる表題は 1 行の区切り', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('BOM')
    ws.addRows([['部品名', '型式', 'メーカ', '数量'], ['リレー', 'MY4N', 'オムロン', 1], ['リレー', 'MY2N', '"', 2], ['■ 電源部', '', '', ''], ['', '', '', ''], ['ヒューズ', 'F-10', 'サトー', 3]])
    ws.mergeCells('A4:D5')
    const r = parseBomPaste(await xlsxToTsv((await wb.xlsx.writeBuffer()) as ArrayBuffer))
    expect(r.rows.map((x) => [x.name, x.maker])).toEqual([['リレー', 'オムロン'], ['リレー', 'オムロン'], ['ヒューズ', 'サトー']])
  })
})

describe('ラウンド 15 の版の印（ベテラン）', () => {
  it('Was/Is・current/proposed・型式(修正) は新しい列', () => {
    expect(parseBomPaste('Description\tP/N (Was)\tP/N (Is)\tQty\nRelay\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('Description\tcurrent P/N\tproposed P/N\tQty\nRelay\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\t型式\t型式(修正)\t数量\nリレー\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
  })
})

describe('ラウンド 16 の取り込み（新人）', () => {
  it('変えた行だけ変更後を書く表で、1 行だけ新旧とも書いても、変えていない行・変更なし・同左の行を消さない', () => {
    const r = parseBomPaste('品名\t型式\t変更後型式\t数量\t変更後数量\nリレー\tMY2N\tMY4N\t2\t2\n端子台\tXW2B\t\t3\t\nヒューズ\tF-10\t変更なし\t4\t同左\nタイマ\tH3CR\t\t1\t')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 2], ['端子台', 'XW2B', 3], ['ヒューズ', 'F-10', 4], ['タイマ', 'H3CR', 1]])
  })
  it('備考の ※削除・今回削除・（削除）は削除、削除しない は残す', () => {
    const r = parseBomPaste('品名\t型式(旧)\t型式(新)\t数量\t備考\nリレー\tMY2N\tMY4N\t1\t\nタイマ\tH3Y\t\t1\t※削除\n端子\tXW2A\t\t1\t今回削除\nヒューズ\tF-1\t\t1\t（削除）\nソケット\tPYF\t\t1\t削除しない')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'ソケット'])
  })
  it('2 段目の「現行｜変更」は 1 段にまとめて変更の列', () => {
    const r = parseBomPaste('品名\t型式\t\t数量\t\n\t現行\t変更\t現行\t変更\nリレー\tMY2N\tMY4N-D2\t2\t4')
    expect(r.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['MY4N-D2', 4]])
  })
  it('号機ごとの数量（合計の列なし）は足す、#1｜#2｜計 は計、1台当り×台数 は掛ける、A号機｜B号機｜合計 は合計', () => {
    expect(parseBomPaste('品名\t型式\t数量\t\n\t\t1号機\t2号機\nリレー\tMY4N\t3\t3').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t数量\t\t\n\t\t#1\t#2\t計\nリレー\tMY4N\t3\t3\t6').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t数量\t\n\t\t1台当り\t台数\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t数量\t\t\n\t\tA号機\tB号機\t合計\nリレー\tMY4N\t2\t3\t5').rows[0].qtyNeeded).toBe(5)
  })
  it('表題欄「数量｜1」を見出しにしない', () => {
    const r = parseBomPaste('品名\t制御盤A\t数量\t1\n\n品名\t型式\t数量\nリレー\tMY4N\t4')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([4])
  })
  it('言い方の違うページの見出し（名称｜形番｜製造元｜個数）を部品にしない', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t1\n名称\t形番\t製造元\t個数\n端子台\tXW2B\tオムロン\t2')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('新の列の（削除）・削除済・取外し・廃止品・ー削除ー・不使用、〃〃・々・上と同じ・上記に同じ・同', () => {
    const r = parseBomPaste('品名\t型式\t新型式\t数量\nリレー\tMY2N\tMY4N\t1\nA\tX1\t（削除）\t1\nB\tX2\t削除済\t1\nC\tX3\t取外し\t1\nD\tX4\t廃止品\t1\nE\tX5\tー削除ー\t1\nF\tX6\t不使用\t1')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
    const d = parseBomPaste('品名\t型式\tメーカー\t数量\nリレー\tMY4N\tオムロン\t1\nA\tX1\t〃〃\t1\nB\tX2\t々\t1\nC\tX3\t上と同じ\t1\nD\tX4\t上記に同じ\t1\nE\tX5\t同\t1')
    expect(d.rows.map((x) => x.maker)).toEqual(Array(6).fill('オムロン'))
  })
})

describe('ラウンド 16 の取り込み（ベテラン）', () => {
  it('V16-01 変えた行のほかの変更後の列に同じ値を書き写しても、変えていない行を消さない', () => {
    const r = parseBomPaste('部品名\t型式\t変更後型式\tメーカ\t変更後メーカ\t数量\nリレー\tMY2N\tMY4N\tオムロン\tオムロン\t1\n端子台\tXW2B\t\tオムロン\t\t2\nヒューズ\tF-10\t\tサトー\t\t3')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台', 'ヒューズ'])
    const s = parseBomPaste('部品名\t旧型式\t新型式\t旧数量\t新数量\nリレー\tMY2N\tMY4N\t10\t10\n端子台\tXW2B\t\t2\t')
    expect(s.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('V16-02 上の段「部品名・旧・新」を繰り返す貼り付けで 2 ページ目の部品名を消さない', () => {
    const page = '部品名\t旧\t\t新\t\n\t型式\t数量\t型式\t数量'
    const r = parseBomPaste(`${page}\nリレー\tMY2N\t1\tMY4N\t2\n${page}\n端子台\tXW2A\t1\tXW2B\t2`)
    expect(r.rows.map((x) => [x.name, x.model])).toEqual([['リレー', 'MY4N'], ['端子台', 'XW2B']])
  })
  it('V16-03 項目の右に属性の列がある見出し（寸法・定格・Value・Footprint・DNP）を表題欄にしない', () => {
    expect(parseBomPaste('部品名\t寸法\t型式\t定格\t数量\t発注先\nリレー\t30x20\tMY4N\tDC24V\t12\tA社').rows[0]).toMatchObject({ name: 'リレー', model: 'MY4N', qtyNeeded: 12 })
    expect(parseBomPaste('Description\tValue\tMPN\tFootprint\tQty\tDNP\nCap\t10uF\tGRM188\t0603\t10\t').rows[0]).toMatchObject({ name: 'Cap', model: 'GRM188', qtyNeeded: 10 })
    expect(parseBomPaste('品名\t色\t型式\t材料\t数量\t担当\nカバー\t白\tC-1\tABS\t2\t山田').rows[0]).toMatchObject({ name: 'カバー', model: 'C-1', qtyNeeded: 2 })
  })
  it('V16-04 型式(変更)・変更 型式・数量(変更) は新しい列', () => {
    expect(parseBomPaste('部品名\t型式\t型式(変更)\t数量\nリレー\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\t型式\t変更 型式\t数量\nリレー\tMY2N\tMY4N\t1').rows[0].model).toBe('MY4N')
    expect(parseBomPaste('部品名\t型式\t数量\t数量(変更)\nリレー\tMY4N\t10\t12').rows[0].qtyNeeded).toBe(12)
  })
  it('V16-05 / V16-13 新の列の〃は、上の行の新の列が空・－なら変えていない（最初の行も）', () => {
    const r = parseBomPaste('部品名\t型式\t新型式\t数量\t新数量\n端子台\tXW2B\t－\t2\t－\nヒューズ\tF-10\t〃\t4\t〃')
    expect(r.rows.map((x) => [x.model, x.qtyNeeded])).toEqual([['XW2B', 2], ['F-10', 4]])
    expect(parseBomPaste('部品名\t型式\t新型式\t数量\nリレーA\tMY2N\t〃\t1').rows[0].model).toBe('MY2N')
  })
  it('V16-06 変更後の型式に値があれば、変更後メーカの「なし」で行を消さない', () => {
    const r = parseBomPaste('部品名\t型式\t変更後型式\tメーカ\t変更後メーカ\t数量\nリレー\tMY2N\tMY4N\tオムロン\tなし\t1\n端子台\tXW2B\tXW2C\tオムロン\tオムロン\t2')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('V16-08 員数の下に 1台当り・合計 は合計', () => {
    expect(parseBomPaste('部品名\t型式\t員数\t\t単価\t金額\n\t\t1台当り\t合計\t\t\nリレー\tMY4N\t4\t12\t100\t1200').rows[0].qtyNeeded).toBe(12)
  })
  it('V16-10 上の段がページで少し違っても（P.2・旧／新）部品にしない', () => {
    const r = parseBomPaste('部品名\t変更前\t\t変更後\t\tP.1\n部品名\t型式\t数量\t型式\t数量\t\nリレー\tMY2N\t1\tMY4N\t2\t\n部品名\t旧\t\t新\t\tP.2\n部品名\t型式\t数量\t型式\t数量\t\n端子台\tXW2A\t1\tXW2B\t2\t')
    expect(r.rows.map((x) => [x.name, x.model])).toEqual([['リレー', 'MY4N'], ['端子台', 'XW2B']])
  })
  it('V16-11 品目名・メーカ名・必要数量・部品名称・数量(個) の言い換えも見出し', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t1\n品目名\t型番\tメーカ名\t必要数量\n端子台\tXW2B\tオムロン\t2\n部品名称\t形式\tメーカー\t数量(個)\nヒューズ\tF-10\tサトー\t3')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台', 'ヒューズ'])
  })
  it('V16-12 変えていない行の備考「撤去後に再取付」「Remove film」で行を消さない', () => {
    const r = parseBomPaste('部品名\t型式\t変更後型式\t数量\t備考\nリレー\tMY2N\tMY4N\t1\t\n端子台\tXW2B\t\t2\t撤去後に再取付\nカバー\tC-1\t\t1\tRemove film before mounting')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台', 'カバー'])
  })
  it('V16-16 合計(税込) ¥13,200 を部品にしない', () => {
    expect(parseBomPaste('部品名\t型式\t数量\nリレー\tMY4N\t1\n合計(税込) ¥13,200\t\t').rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('V15-03 貼り付け・CSV の「"」だけのセルで後ろの行がつながらない', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t1\nリレー\tMY2N\t"\t2\nヒューズ\tF-10\tサトー\t3')
    expect(r.rows.map((x) => [x.name, x.maker])).toEqual([['リレー', 'オムロン'], ['リレー', 'オムロン'], ['ヒューズ', 'サトー']])
  })
})

describe('ラウンド 17 の取り込み（新人）', () => {
  it('N17-01 全行を書き写した変更図で、変更後を空にした 2 行は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t2\nタイマ\tH3CR-A8\tH3CR-A8\tオムロン\t1\t1\nブレーカ\tNF32-SV\t\t三菱電機\t1\t\n端子台\tXW2B-20G4\tXW2B-20G4\tオムロン\t4\t4\nランプ\tL-1\t\tIDEC\t1\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', '端子台'])
  })
  it('N17-02 備考の「削除（Rev.1）」「削除のこと」「廃止（代替なし）」「削除→不要」は削除、「撤去後に再取付」は残す', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考\nリレー\tMY2N\tMY4N\tオムロン\t1\t\nタイマ\tH3Y\t\tオムロン\t1\t削除（Rev.1）\nランプ\tL-1\t\tIDEC\t1\t廃止（代替なし）\nソケット\tPYF\t\tオムロン\t1\t削除のこと\nヒューズ\tF-1\t\tサトー\t1\t削除→不要\n端子台\tXW2B\t\tオムロン\t2\t撤去後に再取付')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('N17-03 新の列「－」＋備考「廃止」、新の型式「削除」＋新の数量 0 は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\t備考\nリレー\tMY2N\tMY4N\tオムロン\t2\t4\t\nヒューズ\tF-10\t削除\tサトー\t1\t0\t\nランプ\tL-1\t－\tIDEC\t1\t－\t廃止\n端子台\tXW2B\t\tオムロン\t2\t\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('N17-04 1 段の見出しの 員数｜台数｜必要数・数量/台｜製作台数｜手配数・数量(1台分)｜数量(3台分)・1号機数量｜2号機数量・数量 1号機｜数量 2号機', () => {
    expect(parseBomPaste('品名\t型式\t員数\t台数\t必要数\nリレー\tMY4N\t2\t3\t6').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t数量/台\t製作台数\t手配数\nリレー\tMY4N\t2\t3\t6').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t数量(1台分)\t数量(3台分)\nリレー\tMY4N\t2\t6').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\t1号機数量\t2号機数量\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(5)
    expect(parseBomPaste('品名\t型式\t数量 1号機\t数量 2号機\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(5)
    expect(parseBomPaste('品名\t型式\t員数\t台数\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(6)
    expect(parseBomPaste('品名\t型式\tA号機\tB号機\t合計\nリレー\tMY4N\t2\t3\t5').rows[0].qtyNeeded).toBe(5)
    expect(parseBomPaste('品名\t型式\t1号機\t2号機\t計\nリレー\tMY4N\t2\t3\t5').rows[0].qtyNeeded).toBe(5)
  })
  it('N17-05 / N17-06 号機を足すとき 2(予備1)・2+1 も、予備の列も足す', () => {
    const r = parseBomPaste('品名\t型式\t数量\t\n\t\t1号機\t2号機\nリレー\tMY4N\t2\t2(予備1)\nソケット\tPYF\t2\t2+1')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([5, 5])
    const s = parseBomPaste('品名\t型式\tメーカー\t数量\t\t\n\t\t\t1号機\t2号機\t予備\nリレー\tMY4N-D2\tオムロン\t2\t2\t1\nタイマ\tH3CR\tオムロン\t1\t1\t0')
    expect(s.rows.map((x) => x.qtyNeeded)).toEqual([5, 2])
  })
  it('N17-07 DNP・Not Fitted の行は取り込まない', () => {
    const r = parseBomPaste('Designator\tDescription\tManufacturer\tMPN\tQty\tFitted\nR1, R2\tResistor\tKOA\tRK73\t2\tFitted\nC1\tCapacitor\tMurata\tGRM188\t1\tNot Fitted')
    expect(r.rows.map((x) => x.name)).toEqual(['Resistor'])
    const d = parseBomPaste('Designator\tDescription\tMPN\tQty\tDNP\nR1\tResistor\tRK73\t2\t\nC1\tCapacitor\tGRM188\t1\tDNP')
    expect(d.rows.map((x) => x.name)).toEqual(['Resistor'])
  })
  it('N17-08 削除した行のすぐ下の〃は削除した行の値', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\nタイマ\tH3Y-2\t削除\t三菱電機\t1\nブレーカ\tNF32-SV\tNF32-SVF\t〃\t1')
    expect(r.rows.map((x) => [x.name, x.maker])).toEqual([['リレー', 'オムロン'], ['ブレーカ', '三菱電機']])
  })
  it('N17-11 署名欄（作成｜山田｜承認｜鈴木）は部品にしない', () => {
    const r = parseBomPaste('部品表（1/2）\n品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2\n以下余白\n作成\t山田\t承認\t鈴木')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ'])
  })
  it('U17-06 KiCad の Reference・Value・Footprint は Value を部品名', () => {
    const r = parseBomPaste('Reference\tValue\tFootprint\tQty\nR1,R2\t10k\tR_0603\t2')
    expect(r.rows[0]).toMatchObject({ name: '10k', qtyNeeded: 2 })
  })
})
