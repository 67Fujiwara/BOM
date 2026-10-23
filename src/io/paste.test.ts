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
  it('新の列の －・〃・同左・変更なし は変えていない、削除・廃止は取り込まない', () => {
    const r = parseBomPaste('部品名\t型式\t新型式\t数量\t新数量\nリレー\tMY2N\tMY4N\t1\t2\n端子台\tXW2B\t－\t3\t〃\nヒューズ\tF-10\t変更なし\t4\t同左\nタイマ\tH3Y\t削除\t1\t削除')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 2], ['端子台', 'XW2B', 3], ['ヒューズ', 'F-10', 4]])
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
