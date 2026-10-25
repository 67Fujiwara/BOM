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
  it('N17-01 全行を書き写した変更図で、変更後を空にした 2 行は削除（書き写しと空が同じ数なら【削除？】で設計に聞く N19-04）', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t2\nタイマ\tH3CR-A8\tH3CR-A8\tオムロン\t1\t1\nブレーカ\tNF32-SV\t\t三菱電機\t1\t\n端子台\tXW2B-20G4\tXW2B-20G4\tオムロン\t4\t4\nランプ\tL-1\t\tIDEC\t1\t')
    expect(r.rows.map((x) => [x.name, x.note ?? ''])).toEqual([['リレー', ''], ['タイマ', ''], ['ブレーカ', '【削除？】'], ['端子台', ''], ['ランプ', '【削除？】']])
    const s = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\t2\t2\nタイマ\tH3CR-A8\tH3CR-A8\t1\t1\nソケット\tPY\tPY\t1\t1\n端子台\tXW2B-20G4\tXW2B-20G4\t4\t4\nランプ\tL-1\t\t1\t')
    expect(s.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'ソケット', '端子台'])
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

describe('ラウンド 17 の取り込み（ベテラン）', () => {
  it('V17-03 CSV・タブ区切りの「"」（〃）や 1/2" で行がつながらない', () => {
    const csv = parseBomPaste('部品名,型式,メーカ,数量\nリレーA,MY4N,オムロン,4\nリレーB,MY2N,",4\n端子台,XW2B,オムロン,2\nヒューズ,F-10,",4\nランプ,L-1,IDEC,1')
    expect(csv.rows.map((x) => [x.name, x.maker])).toEqual([['リレーA', 'オムロン'], ['リレーB', 'オムロン'], ['端子台', 'オムロン'], ['ヒューズ', 'オムロン'], ['ランプ', 'IDEC']])
    const tsv = parseBomPaste('部品名\t型式\t数量\t備考\nリレー\tMY4N\t1\t予備\nタイマ\tH3CR\t2\t"\n"\tH3CR-B\t3\t\nグランド 1/2"\tG-1\t1\t')
    expect(tsv.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'タイマ', 'グランド 1/2"'])
  })
  it('V17-04 縦の表題欄の下の EDA・属性の見出し', () => {
    const r = parseBomPaste('図番\t品名\t作成日\t作成者\nD-123\t制御基板A\t2026-10-01\t山田\n\nDescription\tValue\tMPN\tFootprint\tQty\tDNP\nCap\t10uF\tGRM188\t0603\t10\t')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['Cap', 'GRM188', 10]])
    const s = parseBomPaste('品名\t図番\n制御盤A\tD-1\n部品名\t寸法\t型式\t定格\t数量\t発注先\nリレー\t30x20\tMY4N\tDC24V\t12\tA社')
    expect(s.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['リレー', 'MY4N', 12]])
  })
  it('V17-05 書き写した表で 3 行の削除、変えた行だけの表で 4/5 行を変えた', () => {
    const cp = parseBomPaste(['品名\t旧型式\t新型式\t旧数量\t新数量', ...Array.from({ length: 10 }, (_, i) => (i < 3 ? `P${i}\tA${i}\t\t1\t` : `P${i}\tA${i}\tA${i}\t1\t1`))].join('\n'))
    expect(cp.rows.length).toBe(7)
    const sp = parseBomPaste(['品名\t旧型式\t新型式\t数量', ...Array.from({ length: 5 }, (_, i) => (i < 4 ? `P${i}\tA${i}\tB${i}\t1` : `P${i}\tA${i}\t\t1`))].join('\n'))
    expect(sp.rows.length).toBe(5)
  })
  it('V17-07 旧の列の〃は上の行の旧の値', () => {
    const r = parseBomPaste('部品名\t旧型式\t新型式\t数量\nリレーA\tMY2N\tMY4N\t1\nリレーB\t〃\t\t1\nリレーC\t〃\t－\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N', 'MY2N', 'MY2N'])
  })
  it('V17-08 1号機・2号機・予備、旧／新×号機、1 段の 数量 #1・数量 #2 は足す', () => {
    expect(parseBomPaste('品名\t型式\t1号機\t2号機\t予備\nリレー\tMY4N\t2\t2\t1').rows[0].qtyNeeded).toBe(5)
    expect(parseBomPaste('品名\t型式\t数量 #1\t数量 #2\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(5)
    expect(parseBomPaste('品名\t型式\t旧1号機\t旧2号機\t新1号機\t新2号機\nリレー\tMY4N\t1\t1\t2\t3').rows[0].qtyNeeded).toBe(5)
  })
  it('V17-09 号機の数量の〃は上の行の値', () => {
    const r = parseBomPaste('品名\t型式\t1号機\t2号機\nリレー\tMY4N\t2\t3\nタイマ\tH3CR\t〃\t1')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([5, 3])
  })
})

describe('ラウンド 18 の取り込み（新人）', () => {
  it('N18-01 数量だけ変えた行に新の型式（旧と同じ）を書いても、変えていない行を消さない', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考\nリレー\tMY2N\tMY4N-D2\tオムロン\t4\t型式変更\nタイマ\tH3CR-A8\tH3CR-A8\tオムロン\t2\t数量変更 1→2\nソケット\tPYF14A\tPYF14A\tオムロン\t4\t数量変更 2→4\n端子台\tXW2B-20G4\t\tオムロン\t4\t\nランプ\tL-1\t\tIDEC\t1\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'ソケット', '端子台', 'ランプ'])
  })
  it('N17-01 残り 書き写した表の「－」は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N\t2\t2\nタイマ\tH3CR\tH3CR\t1\t1\n端子台\tXW2B\tXW2B\t4\t4\nランプ\tL-1\t－\t1\t－')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', '端子台'])
  })
  it('N18-02 / N18-03 備考の削除不要・撤去不要・削除取消・廃止取りやめ・削除無・廃止品から変更済 は残す、削除します・要削除・Rev.1 削除・不要・撤去済 は削除', () => {
    const keep = ['削除不要', '撤去不要（流用）', '削除取消（Rev.2で復活）', '廃止取りやめ', '削除無', '廃止品から変更済']
    const del = ['削除します', '要削除', 'Rev.1 削除', '不要', '撤去済']
    const rows = [...keep.map((n, i) => `K${i}\tA${i}\t\t1\t${n}`), ...del.map((n, i) => `D${i}\tB${i}\t\t1\t${n}`)]
    const r = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...rows].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', ...keep.map((_, i) => `K${i}`)])
  })
  it('N14-02 残り 新の型式の「撤去済」「削除（R012に置換）」は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\nリレー\tMY2N\tMY4N\t1\nタイマ\tH3Y\t撤去済\t1\nランプ\tL-1\t削除（R012に置換）\t1')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('N18-04 セルの最後・最初に改行のある Excel の複数行のセルを 1 つのセルとして読む', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\n"リレー\n"\tMY4N-D2\tオムロン\t4\nタイマ\t"\nH3CR-A8"\tオムロン\t2')
    expect(r.rows.map((x) => [x.name?.trim(), x.model?.trim(), x.qtyNeeded])).toEqual([['リレー', 'MY4N-D2', 4], ['タイマ', 'H3CR-A8', 2]])
  })
  it('N18-05 / N17-07 残り メーカの DNP（大日本印刷）は残す、実装 無・しない、未実装（将来用）は外す', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\nリレー\tMY4N\tオムロン\t4\n反射フィルム\tRF-200\tDNP\t2')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '反射フィルム'])
    const s = parseBomPaste('品名\t型式\t数量\t実装\t備考\nA\tX1\t1\t有\t\nB\tX2\t1\t無\t\nC\tX3\t1\tしない\t\nD\tX4\t1\t\t未実装（将来用）')
    expect(s.rows.map((x) => x.name)).toEqual(['A'])
  })
  it('N18-06 1台目｜2台目 は足す、N18-08 合計が空なら号機を足す、U18-05 数量｜台数 は掛ける', () => {
    expect(parseBomPaste('品名\t型式\tメーカー\t1台目\t2台目\nリレー\tMY4N\tオムロン\t2\t2').rows[0].qtyNeeded).toBe(4)
    expect(parseBomPaste('品名\t型式\t1号機\t2号機\t合計\nリレー\tMY4N\t2\t2\t4\nタイマ\tH3CR\t1\t1\t').rows.map((x) => x.qtyNeeded)).toEqual([4, 2])
    expect(parseBomPaste('品名\t型式\t数量\t台数\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(6)
  })
  it('N18-07 表題欄の製作台数と 1台当り数量 は掛ける', () => {
    const r = parseBomPaste('盤名\t制御盤A\t製作台数\t3台\n\n品名\t型式\tメーカー\t1台当り数量\nリレー\tMY4N\tオムロン\t2\nタイマ\tH3CR\tオムロン\t1')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([6, 3])
    expect(r.warnings.join()).toContain('製作台数')
  })
  it('N18-09 Altium の Comment｜Description は Description を部品名', () => {
    const r = parseBomPaste('Comment\tDescription\tDesignator\tFootprint\tLibRef\tQuantity\tManufacturer\tManufacturer Part Number\n10k\tChip Resistor\tR1, R2\t0603\tRES\t2\tKOA\tRK73H1J')
    expect(r.rows[0]).toMatchObject({ name: 'Chip Resistor', model: 'RK73H1J', qtyNeeded: 2 })
  })
})

describe('ラウンド 18 の取り込み（ベテラン）', () => {
  it('V18-01 CSV の複数行のセル（コンマを含む）・前後に改行のあるセル', () => {
    const r = parseBomPaste('部品名,型式,数量,備考\nリレー,MY4N,1,"盤内上段, 左側\n(要確認)"\nタイマ,H3CR,2,')
    expect(r.rows.map((x) => [x.name, x.qtyNeeded])).toEqual([['リレー', 1], ['タイマ', 2]])
  })
  it('V18-02 備考の「取外し不要」「撤去品を流用」は残す', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\t備考\nリレー\tMY2N\tMY4N\t1\t\nタイマ\tH3Y\t\t1\t取外し不要\nランプ\tL-1\t\t1\t撤去品を流用')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'ランプ'])
  })
  it('V18-03 取付位置だけ変えた行に同じ型式を書いた表は書き写す表でない、〃で書き写した表は書き写す表', () => {
    const a = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\t変更内容\nA\tX1\tX1\t1\t取付位置変更\nB\tX2\tX2\t1\t取付位置変更\nC\tX3\tX3\t1\t取付位置変更\nD\tX4\t\t1\t\nE\tX5\t\t1\t\nF\tX6\t\t1\t')
    expect(a.rows.length).toBe(6)
    const b = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nA\tX1\tX1\t1\t1\nB\t〃\t〃\t〃\t〃\nC\tX3\tX3\t2\t2\nD\tX4\t\t1\t')
    expect(b.rows.map((x) => x.name)).toEqual(['A', 'B', 'C'])
  })
  it('V18-04 全角の「ＤＮＰ」の見出し、実装の列の「-」', () => {
    const a = parseBomPaste('品名\t型式\t数量\tＤＮＰ\n抵抗A\tR1\t1\t0\n抵抗B\tR2\t1\t1\nコンデンサ\tC1\t1\t0')
    expect(a.rows.map((x) => x.name)).toEqual(['抵抗A', 'コンデンサ'])
    const b = parseBomPaste('品名\t型式\t数量\t実装\nA\tX1\t1\tリフロー\nB\tX2\t1\t-')
    expect(b.rows.map((x) => x.name)).toEqual(['A', 'B'])
  })
  it('V18-05 ほかに部品名の列があれば Comment は備考', () => {
    const r = parseBomPaste('部品名\t型式\tメーカ\t数量\tComment\nリレー\tMY4N\tオムロン\t1\t盤内上段')
    expect(r.rows[0]).toMatchObject({ name: 'リレー', note: '盤内上段' })
  })
  it('V18-06 必要数と手配数があれば必要数', () => {
    expect(parseBomPaste('品名\t型式\t必要数\t手配数\n抵抗\tR1\t3\t100').rows[0].qtyNeeded).toBe(3)
  })
  it('V18-07 削除の下の〃・同上は削除、新の数量 0 の下の〃も削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\nリレーA\tMY2N\tMY4N\t1\nリレーB\tMY2N\t削除\t1\nリレーC\tMY2N\t〃\t1\nリレーD\tMY2N\t同上\t1')
    expect(r.rows.map((x) => x.name)).toEqual(['リレーA'])
  })
  it('V18-08 号機の旧／新が後ろ・2 段目', () => {
    expect(parseBomPaste('品名\t型式\t1号機(旧)\t2号機(旧)\t1号機(新)\t2号機(新)\nリレー\tMY4N\t1\t1\t2\t3').rows[0].qtyNeeded).toBe(5)
  })
  it('V18-09 欠番・取止め・中止・Del、全角の０・0個 は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N\t1\t2\nA\tX1\t欠番\t1\t\nB\tX2\t取止め\t1\t\nC\tX3\t中止\t1\t\nD\tX4\tDel\t1\t\nE\tX5\tX5\t1\t０\nF\tX6\tX6\t1\t0個')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('V18-10 縦の表題欄（品名・数量 ＋ 制御盤A・2）の下の属性の見出し', () => {
    const r = parseBomPaste('品名\t数量\n制御盤A\t2\n品名\t色\t型式\t材料\t数量\t担当\nカバー\t白\tC-1\tABS\t2\t山田')
    expect(r.rows.map((x) => [x.name, x.model, x.qtyNeeded])).toEqual([['カバー', 'C-1', 2]])
  })
  it('V18-14 見出しの下の単位だけの行は部品にしない', () => {
    expect(parseBomPaste('品名\t型式\t数量\t単価\n\t\t(個)\t(円)\nリレー\tMY4N\t2\t100').rows.map((x) => x.name)).toEqual(['リレー'])
  })
})

describe('ラウンド 19 の取り込み（新人）', () => {
  const head = '品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考\nリレー\tMY2N\tMY4N-D2\tオムロン\t4\t'
  const names = (notes: string[]) => parseBomPaste([head, ...notes.map((n, i) => `部品${i}\tP-${i}\t\tオムロン\t1\t${n}`), '端子台\tXW2B\t\tオムロン\t4\t'].join('\n')).rows.map((x) => x.name)
  it('N19-01 備考の削除しました・削除した・削除してください・不要のため削除・Rev.2で削除・B版にて削除・設計変更により削除・欠番・取止め・中止・Del は削除', () => {
    expect(names(['削除しました', '削除した', '削除してください', '不要のため削除', 'Rev.2で削除', 'B版にて削除', '設計変更により削除', '欠番', '取止め', '中止', 'Del'])).toEqual(['リレー', '端子台'])
  })
  it('N19-01 新の型式の「削除しました」「削除してください」「Del.」は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\nリレー\tMY2N\tMY4N\t1\nA\tX1\t削除しました\t1\nB\tX2\t削除してください\t1\nC\tX3\tDel.\t1')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('N19-02 備考の削除はしない・削除は不要・削除保留・削除見送り・削除NG・撤去後再取付 は残す', () => {
    const keep = ['削除はしない', '削除は不要', '削除保留', '削除見送り', '削除NG（客先指定）', '撤去後再取付']
    expect(names(keep)).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
  })
  it('N19-03 新の品名が「取外し工具」「撤去用ブラケット」「廃止穴用カバー」でも削除にしない', () => {
    const r = parseBomPaste('品名（旧）\t品名（新）\t型式\tメーカー\t数量\n工具\t取外し工具\tTR-10\tホーザン\t1\nブラケット\t撤去用ブラケット\tBK-2\tミスミ\t2\nカバー\t廃止穴用カバー\tCV-3\tミスミ\t2\nリレー\t\tMY4N-D2\tオムロン\t4')
    expect(r.rows.map((x) => x.name)).toEqual(['取外し工具', '撤去用ブラケット', '廃止穴用カバー', 'リレー'])
  })
  it('N19-04 版の印の無い列（メーカ）だけ変えた行は書き写しに数えない', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\tメーカー\nリレー\tMY2N\tMY4N-D2\t4\t4\tオムロン\nタイマ\tH3CR-A8\tH3CR-A8\t1\t1\tパナソニック\nソケット\tPYF14A\tPYF14A\t2\t2\tIDEC\n端子台\tXW2B-20G4\t\t4\t\tオムロン\nランプ\tL-1\t\t1\t\tIDEC')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'ソケット', '端子台', 'ランプ'])
    expect(r.rows.map((x) => x.note ?? '')).toEqual(['', '', '', '【削除？】', '【削除？】'])
  })
  it('N19-05 区分・変更区分の「削除」の行は取り込まない、区分は分類にしない', () => {
    const a = parseBomPaste('区分\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N-D2\t4\n削除\tタイマ\tH3CR-A8\t\t1\n追加\tランプ\t\tL-1\t2\n\t端子台\tXW2B-20G4\t\t4')
    expect(a.rows.map((x) => [x.name, x.category ?? ''])).toEqual([['リレー', ''], ['ランプ', ''], ['端子台', '']])
    const b = parseBomPaste('品名\t型式\t数量\t変更区分\nリレー\tMY4N\t4\t変更\nタイマ\tH3CR\t1\t削除\nランプ\tL-1\t2\t追加')
    expect(b.rows.map((x) => x.name)).toEqual(['リレー', 'ランプ'])
    expect(b.warnings.join()).toContain('削除')
  })
  it('N19-05 全部書き写した表で備考だけ「削除」の行は削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\t備考\nリレー\tMY2N\tMY4N\t4\t型式変更\nタイマ\tH3CR\tH3CR\t1\t\nランプ\tL-1\tL-1\t2\t削除\n端子台\tXW2B\tXW2B\t4\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', '端子台'])
  })
  it('N19-06 員数/台｜製作台数、1台当数量｜台数 は掛ける', () => {
    expect(parseBomPaste('品名\t型式\tメーカー\t員数/台\t製作台数\nリレー\tMY4N\tオムロン\t2\t3\nタイマ\tH3CR\tオムロン\t1\t3').rows.map((x) => x.qtyNeeded)).toEqual([6, 3])
    expect(parseBomPaste('品名\t型式\t1台当数量\t台数\nリレー\tMY4N\t2\t3').rows[0].qtyNeeded).toBe(6)
  })
  it('N19-06 表題欄の製作数量 3台・3台（予備機含まず）・縦の表題欄・見出しの右の製作台数 と 1台当り数量・員数', () => {
    const q = (s: string) => parseBomPaste(s).rows.map((x) => x.qtyNeeded)
    expect(q('盤名\t制御盤A\t製作数量\t3台\n品名\t型式\tメーカー\t1台当り数量\nリレー\tMY4N\tオムロン\t2')).toEqual([6])
    expect(q('盤名\t制御盤A\t製作台数\t3台（予備機含まず）\n品名\t型式\tメーカー\t1台当り数量\nリレー\tMY4N\tオムロン\t2')).toEqual([6])
    expect(q('盤名\t製作台数\n制御盤A\t3\n\n品名\t型式\tメーカー\t1台当り数量\nリレー\tMY4N\tオムロン\t2')).toEqual([6])
    expect(q('盤名\t制御盤A\t製作台数\t3台\n品名\t型式\tメーカー\t員数\nリレー\tMY4N\tオムロン\t2')).toEqual([6])
    expect(q('盤名\t制御盤A\t製作台数\t3台\n品名\t型式\tメーカー\t1台当数量\nリレー\tMY4N\tオムロン\t2')).toEqual([6])
    expect(q('品名\t型式\tメーカー\t1台当り数量\t\t製作台数\t3\nリレー\tMY4N\tオムロン\t2\t\t\t\nタイマ\tH3CR\tオムロン\t1\t\t\t')).toEqual([6, 3])
  })
  it('N19-07 2 段の見出し「号機別数量 / 1｜2｜3」は足す', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t号機別数量\t\t\n品名\t型式\tメーカー\t1\t2\t3\nリレー\tMY4N\tオムロン\t2\t2\t2\nタイマ\tH3CR\tオムロン\t1\t1\t1')
    expect(r.rows.map((x) => [x.name, x.qtyNeeded])).toEqual([['リレー', 6], ['タイマ', 3]])
    const s = parseBomPaste('品名\t型式\tメーカー\t号機別数量\t\t\n\t\t\t1\t2\t3\nリレー\tMY4N\tオムロン\t2\t2\t2')
    expect(s.rows.map((x) => [x.name, x.qtyNeeded])).toEqual([['リレー', 6]])
  })
  it('N19-08 No.1｜No.2、1号機用｜2号機用 は足す', () => {
    expect(parseBomPaste('品名\t型式\tメーカー\tNo.1\tNo.2\nリレー\tMY4N\tオムロン\t2\t2').rows[0].qtyNeeded).toBe(4)
    expect(parseBomPaste('品名\t型式\tメーカー\t1号機用\t2号機用\nリレー\tMY4N\tオムロン\t2\t2').rows[0].qtyNeeded).toBe(4)
  })
  it('N19-09 半角カナの見出し', () => {
    const r = parseBomPaste('ﾋﾝﾒｲ\tｶﾀｼｷ\tﾒｰｶｰ\tｽｳﾘｮｳ\nﾘﾚｰ\tMY4N-D2\tｵﾑﾛﾝ\t4\n反射フィルム\tRF-200\tDNP\t2')
    expect(r.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded])).toEqual([['ﾘﾚｰ', 'MY4N-D2', 'ｵﾑﾛﾝ', 4], ['反射フィルム', 'RF-200', 'DNP', 2]])
    expect(parseBomPaste('品名\t型式\tﾒｰｶｰ\t数量\nリレー\tMY4N\tオムロン\t4').rows[0].maker).toBe('オムロン')
  })
  it('N19-10 実装の不要・未、備考の DNP（将来用）・実装無し・実装せず は外す', () => {
    expect(parseBomPaste('品名\t型式\t数量\t実装\nリレー\tA\t4\t実装\nタイマ\tB\t1\t未\nランプ\tC\t1\t不要\nソケット\tD\t2\t－').rows.map((x) => x.name)).toEqual(['リレー', 'ソケット'])
    expect(parseBomPaste('品名\t型式\t数量\t備考\nリレー\tA\t4\t\nタイマ\tB\t1\tDNP（将来用）\nランプ\tC\t1\t実装無し\nソケット\tD\t2\t実装せず').rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('N19-11 Altium で Description が空の行は Comment を部品名に', () => {
    const r = parseBomPaste('Comment\tDescription\tDesignator\tQuantity\tManufacturer\tManufacturer Part Number\n10k\tChip Resistor\tR1, R2\t2\tKOA\tRK73\nLED_Red\t\tD1\t1\tRohm\tSML-310')
    expect(r.rows.map((x) => x.name)).toEqual(['Chip Resistor', 'LED_Red'])
  })
  it('N19-14 型式の「旧→新」は新を使って知らせる', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\t備考\nリレー\tMY2N→MY4N-D2\tオムロン\t4\t型式変更\nランプ\tL-1\tIDEC\t1\t')
    expect(r.rows[0].model).toBe('MY4N-D2')
    expect(r.warnings.join()).toContain('MY2N→MY4N-D2')
  })
})

describe('ラウンド 19 の取り込み（ベテラン）', () => {
  const names = (t: string) => parseBomPaste(t).rows.map((x) => x.name)
  it('V19-01 変えた行だけ書く表で、変えていない行の「－」は変えていない印（取付位置だけ変えた行に同じ型式があっても）', () => {
    const t = '品名\t型式（旧）\t型式（新）\t備考\nA\tX1\tY1\t型式変更\nB\tX2\tX2\t取付位置変更\nC\tX3\tX3\t取付位置変更\nD\tX4\tX4\t取付位置変更\nE\tX5\t－\t\nF\tX6\t－\t'
    expect(names(t)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })
  it('V19-02 書き写した行が何行もあり削除が多い表は、削除を黙って取り込まない（【削除？】で聞く）', () => {
    const copies = Array.from({ length: 6 }, (_, i) => `K${i}\tM${i}\tM${i}`)
    const dels = Array.from({ length: 4 }, (_, i) => `D${i}\tN${i}\t`)
    const r = parseBomPaste(['品名\t型式（旧）\t型式（新）', 'C\tOLD\tNEW', ...copies, ...dels].join('\n'))
    expect(r.rows.filter((x) => x.note?.startsWith('【削除？】')).map((x) => x.name)).toEqual(['D0', 'D1', 'D2', 'D3'])
  })
  it('V19-03 号機ごとの変更表で、新の号機が空の行は旧の号機を足す', () => {
    const r = parseBomPaste('品名\t型式\t1号機(旧)\t2号機(旧)\t1号機(新)\t2号機(新)\nリレー\tMY4N\t1\t1\t7\t7\n端子台\tXW2B\t1\t1\t\t')
    expect(r.rows.map((x) => [x.name, x.qtyNeeded])).toEqual([['リレー', 14], ['端子台', 2]])
  })
  it('V19-04 CSV の「"」（〃の代わり）と、次の行のインチの「"」を囲みにしない（表題の行があっても）', () => {
    const csv = '部品表 制御盤A\n品名,型式,メーカー,数量\nリレーA,MY4N,オムロン,1\nリレーB,MY4N,",2\nグランド,OA-W16 1/2",オーム電機,3\nヒューズ,F-10,オムロン,4'
    const r = parseBomPaste(csv)
    expect(r.rows.map((x) => x.name)).toEqual(['リレーA', 'リレーB', 'グランド', 'ヒューズ'])
  })
  it('V19-04 続き: 普通の見出しの CSV のインチの「"」、見出しの 1 列目が複数行のセル、タブ区切りの備考の「"」の次のインチ', () => {
    const a = parseBomPaste('品名,型式,メーカー,数量\nリレーA,MY4N,オムロン,1\nリレーB,MY4N,",2\nグランド,OA-W16 1/2",オーム電機,3\nヒューズ,F-10,オムロン,4')
    expect(a.rows.map((x) => x.name)).toEqual(['リレーA', 'リレーB', 'グランド', 'ヒューズ'])
    const b = parseBomPaste('"部品名\n(品名)",型式,メーカー,数量\nリレーA,MY4N,オムロン,1\nリレーB,MY4N,",2\nグランド,OA-W16,オーム電機,3\nヒューズ,F-10,オムロン,4')
    expect(b.rows.map((x) => x.name)).toEqual(['リレーA', 'リレーB', 'グランド', 'ヒューズ'])
    const c = parseBomPaste('品名\t型式\tメーカー\t備考\nリレーA\tMY4N\tオムロン\t予備\nリレーB\tMY4N\tオムロン\t"\nグランド 1/2"\tOA-W16\tオーム電機\t\nヒューズ\tF-10\tオムロン\t')
    expect(c.rows.map((x) => x.name)).toEqual(['リレーA', 'リレーB', 'グランド 1/2"', 'ヒューズ'])
  })
  it('V19-05 部品名「未実装基板」・備考「未実装時は短絡」は実装しない印ではない、「未実装（将来用）」は外す', () => {
    expect(names('品名\t型式\t備考\n未実装基板\tPCB-1\t未実装時は短絡\nリレー\tMY4N\t')).toEqual(['未実装基板', 'リレー'])
    expect(names('品名\t型式\t備考\nタイマ\tH3CR\t未実装（将来用）\nリレー\tMY4N\t')).toEqual(['リレー'])
  })
  it('V19-06 備考が削除の印だけのときだけ削除、文（保留・見送り・注意・次回）は残す。「…のため削除」「→削除」「ユニットごと削除」「削除せよ」は削除', () => {
    const keep = ['削除は次回', '削除保留', '削除見送り', '削除検討中', '削除撤回', '廃止延期', '削除禁止', '取外し時注意', '撤去時は2名で作業', '取外し工具を使用', '削除しません']
    const del = ['R012に置換のため削除', '→削除', 'ユニットごと削除', '削除せよ', '旧品削除']
    const rows = [...keep.map((n, i) => `K${i}\tA${i}\t\t1\t${n}`), ...del.map((n, i) => `D${i}\tB${i}\t\t1\t${n}`)]
    const r = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...rows].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', ...keep.map((_, i) => `K${i}`)])
  })
  it('V19-07 取付位置・変更内容を書いた行は、同じ型式を書いても書き写しに数えない', () => {
    const t = '品名\t型式（旧）\t型式（新）\t変更内容\nA\tX1\tY1\t型式変更\nB\tX2\tX2\t取付位置変更\nC\tX3\tX3\t取付位置変更\nD\tX4\tX4\t取付位置変更\nE\tX5\t\t\nF\tX6\t\t'
    expect(names(t)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })
  it('V19-08 変更後の部品名・備考が「取外し工具」「撤去時注意」でも削除にしない', () => {
    const r = parseBomPaste('品名（旧）\t品名（新）\t型式\t備考（旧）\t備考（新）\n工具\t取外し工具\tTK-2\t盤内\t撤去時注意\nジャッキ\t撤去用ジャッキ\tJK-1\t盤内\t取外し時は2名')
    expect(r.rows.map((x) => [x.name, x.note])).toEqual([['取外し工具', '撤去時注意'], ['撤去用ジャッキ', '取外し時は2名']])
  })
  it('V19-09 削除の下の〃・同上は、削除済・×・不要・撤去済・Rev.1 削除・0個 でも削除', () => {
    for (const mark of ['削除済', '×', '不要', '撤去済', 'Rev.1 削除', '削除（R012に置換）']) {
      const r = parseBomPaste(`品名\t型式（旧）\t型式（新）\t数量\nリレーA\tMY2N\tMY4N\t1\nリレーB\tMY2N\t${mark}\t1\nリレーC\tMY2N\t〃\t1`)
      expect(r.rows.map((x) => x.name), mark).toEqual(['リレーA'])
    }
  })
  it('V19-10 数量と手配数があれば数量', () => {
    expect(parseBomPaste('品名\t型式\t数量\t手配数\n抵抗\tR1\t3\t100').rows[0].qtyNeeded).toBe(3)
  })
})

describe('ラウンド 20 の取り込み（新人）', () => {
  const sheet = (notes: string[]) => parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...notes.map((n, i) => `部品${i}\tP-${i}\t\t1\t${n}`), '端子台\tXW2B\t\t4\t'].join('\n'))
  it('N20-01 ふつうの型式の「→」「>」は壊さない', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\nケーブル\tUSB-A→USB-C 変換ケーブル\tサンワ\t1\n電線\tUL1007 AWG22 (赤→黒)\tサンワ\t2')
    expect(r.rows.map((x) => x.model)).toEqual(['USB-A→USB-C 変換ケーブル', 'UL1007 AWG22 (赤→黒)'])
    expect(parseBomPaste('品名\t型式\tメーカー\t数量\t備考\nリレー\tMY2N→MY4N-D2\tオムロン\t4\t型式変更').rows[0].model).toBe('MY4N-D2')
  })
  it('N20-02 変更内容と備考の両方があれば備考を備考に（備考の削除が効く）', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\t変更内容\t備考\nリレー\tMY2N\tMY4N\t1\t型式変更\t盤内\nタイマ\tH3Y\t\t1\t\t削除\n端子台\tXW2B\t\t4\t\t')
    expect(r.rows.map((x) => [x.name, x.note ?? ''])).toEqual([['リレー', '盤内'], ['端子台', '']])
  })
  it('N20-03 書き写した表の「－」の行が書き写しと同数なら、【削除？】で聞く', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\tメーカー\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\tオムロン\t2\t2\nタイマ\tH3CR-A8\tH3CR-A8\tオムロン\t1\t1\nブレーカ\tNF32-SV\t－\t三菱電機\t1\t－\n端子台\tXW2B-20G4\tXW2B-20G4\tオムロン\t4\t4\nランプ\tL-1\t－\tIDEC\t1\t－')
    expect(r.rows.map((x) => x.note ?? '')).toEqual(['', '', '【削除？】', '', '【削除？】'])
  })
  it('N20-04 削除（保留）・削除（しない）・撤去（再取付）・削除→保留 は残す、削除（Rev.1）・削除→不要 は削除', () => {
    const keep = ['削除（保留）', '削除（しない）', '削除（要確認）', '削除（検討中）', '撤去（再取付）', '取外し（再利用）', '削除→保留', '削除→再追加']
    const r = sheet(keep)
    expect(r.rows.filter((x) => !(x.note ?? '').startsWith('【削除？】')).map((x) => x.name)).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
    expect(sheet(['削除（Rev.1）', '削除→不要']).rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('N20-05 変更区分の 削除済・削除品・削除する・×・不要・撤去済・Deleted・除却・D と、〃、変更の種類・ECN区分', () => {
    const vals = ['削除済', '削除品', '削除する', '×', '不要', '撤去済', 'Deleted', 'Removed', '除却', 'D']
    const rows = ['変更区分\t品名\t型式（旧）\t型式（新）\t数量', '変更\tリレー\tMY2N\tMY4N\t4', ...vals.map((v, i) => `${v}\tD${i}\tX${i}\t\t1`), '変更なし\t端子台\tXW2B\t\t4']
    expect(parseBomPaste(rows.join('\n')).rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
    const d = parseBomPaste('変更区分\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N\t4\n削除\tタイマ\tH3Y\t\t1\n〃\tランプ\tL-1\t\t1\n追加\tソケット\t\tPYF\t2')
    expect(d.rows.map((x) => x.name)).toEqual(['リレー', 'ソケット'])
    for (const h of ['変更の種類', 'ECN区分', '変更種別']) {
      expect(parseBomPaste(`${h}\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N\t4\n削除\tタイマ\tH3Y\t\t1`).rows.map((x) => x.name), h).toEqual(['リレー'])
    }
  })
  it('N20-06 備考の 未実装品・未実装部品・未実装です・非実装品・実装しないこと は外す', () => {
    const r = parseBomPaste('品名\t型式\t数量\t備考\nリレー\tA\t1\t\nB\tB\t1\t未実装品\nC\tC\t1\t未実装部品\nD\tD\t1\t未実装です\nE\tE\t1\t非実装品\nF\tF\t1\t実装しないこと\nG\tG\t1\t未実装時は短絡')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'G'])
  })
  it('N20-07 削除と書いたのに判定できない言い方は【削除？】で聞く、削除です・お願いします・完了・ずみ・Rev.B:削除 は削除', () => {
    const del = ['削除です', '削除お願いします', '削除完了', '削除ずみ', '削除となります', 'Rev.B:削除', '(Rev.2)削除', '使用しない']
    expect(sheet(del).rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
    const ask = sheet(['削除に変更', '削除で'])
    expect(ask.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length).toBe(2)
  })
  it('N20-10 部品名「DNP 反射フィルム」は外さない', () => {
    expect(parseBomPaste('品名\t型式\t数量\nDNP 反射フィルム\tRF-1\t2\nリレー\tMY4N\t1').rows.map((x) => x.name)).toEqual(['DNP 反射フィルム', 'リレー'])
  })
  it('N20-08 / N20-09 半角カナの数量（ｽｳﾘﾖｳ）、第1号機・Unit1', () => {
    expect(parseBomPaste('ﾋﾝﾒｲ\tｶﾀｼｷ\tｽｳﾘﾖｳ\nﾘﾚｰ\tMY4N\t4').rows[0].qtyNeeded).toBe(4)
    expect(parseBomPaste('品名\t型式\t第1号機\t第2号機\nリレー\tMY4N\t2\t2').rows[0].qtyNeeded).toBe(4)
    expect(parseBomPaste('品名\t型式\tUnit1\tUnit2\nリレー\tMY4N\t2\t2').rows[0].qtyNeeded).toBe(4)
  })
})

describe('ラウンド 20 の取り込み（ベテラン）', () => {
  it('V20-12 コンマ区切りの 1 行の備考にタブがあっても、コンマ区切りと読む', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `部品${i},M-${i},${i + 1},${i === 2 ? '盤内\t左' : ''}`)
    const r = parseBomPaste(['部品名,型式,数量,備考', ...rows].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(rows.map((_, i) => `部品${i}`))
  })
  it('V20-01 コンマ入りの囲みと同じ行の複数行セル', () => {
    const r = parseBomPaste('品名,型式,メーカー,数量\n"リレー\n(24V)",MY4N,"Omron, Inc.",4\nタイマ,H3CR,オムロン,2\nランプ,L-1,IDEC,1')
    expect(r.rows.map((x) => [x.maker, x.qtyNeeded])).toEqual([['Omron, Inc.', 4], ['オムロン', 2], ['IDEC', 1]])
  })
  it('V20-03 備考「変更なし」「交換不要」の書き写した行は書き写しに数える', () => {
    const t = ['品名\t型式（旧）\t型式（新）\t備考', 'A\tX1\tY1\t型式変更', 'B\tX2\tX2\t変更なし', 'C\tX3\tX3\t交換不要', 'D\tX4\tX4\t', 'E\tX5\t\t', 'F\tX6\t\t'].join('\n')
    // 書き写し 3 行・空 2 行は決められないので、空の 2 行は【削除？】で聞く（黙って残さない）
    const r = parseBomPaste(t)
    expect(r.rows.map((x) => [x.name, (x.note ?? '').startsWith('【削除？】')])).toEqual([['A', false], ['B', false], ['C', false], ['D', false], ['E', true], ['F', true]])
  })
  it('V20-05 型式の「M12→M8 変換」「AC100V>DC24V」は壊さない', () => {
    const r = parseBomPaste('品名\t型式\t数量\nアダプタ\tM12→M8 変換\t1\nトランス\tAC100V>DC24V\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['M12→M8 変換', 'AC100V>DC24V'])
  })
  it('V20-06 部品名「DNP 反射フィルム」・型式「DNP RF-100」は外さない', () => {
    expect(parseBomPaste('品名\t型式\t数量\nDNP 反射フィルム\tRF-1\t2\nフィルム\tDNP RF-100\t1').rows.length).toBe(2)
  })
  it('V20-08 号機ごとの変更表で、変えた号機だけ新を書く行は旧の号機を補う', () => {
    const r = parseBomPaste('品名\t型式\t1号機(旧)\t2号機(旧)\t1号機(新)\t2号機(新)\nリレー\tMY4N\t3\t3\t7\t\n端子台\tXW2B\t1\t1\t\t')
    expect(r.rows.map((x) => x.qtyNeeded)).toEqual([10, 2])
  })
  it('V20-09 「－」の仲間（そのまま・No change・Unicode のダッシュ）は変えていない印', () => {
    const marks = ['そのまま', 'No change', '―', '‐', '同一']
    const t = ['品名\t型式（旧）\t型式（新）', 'A\tX1\tY1', ...marks.map((m, i) => `M${i}\tZ${i}\t${m}`)].join('\n')
    expect(parseBomPaste(t).rows.map((x) => x.model)).toEqual(['Y1', ...marks.map((_, i) => `Z${i}`)])
  })
  it('V20-10 削除→復活・削除（保留）は残す', () => {
    const t = ['品名\t型式（旧）\t型式（新）\t備考', 'A\tX1\tY1\t', 'B\tX2\t\t削除→復活', 'C\tX3\t\t削除（保留）'].join('\n')
    const r = parseBomPaste(t)
    expect(r.rows.map((x) => x.name)).toEqual(['A', 'B', 'C'])
    expect(r.rows.some((x) => (x.note ?? '').startsWith('【削除？】'))).toBe(false)
  })
  it('V20-11 変更区分の 除外・抹消・Remove、見出し「改訂区分」', () => {
    const t = ['改訂区分\t品名\t型式（旧）\t型式（新）', '変更\tA\tX1\tY1', '除外\tB\tX2\t', '抹消\tC\tX3\t', 'Remove\tD\tX4\t', '追加\tE\t\tZ5'].join('\n')
    expect(parseBomPaste(t).rows.map((x) => x.name)).toEqual(['A', 'E'])
  })
})

describe('ラウンド 21 の取り込み（新人）', () => {
  const sheet = (notes: string[]) => parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...notes.map((n, i) => `部品${i}\tP-${i}\t\t1\t${n}`), '端子台\tXW2B\t\t4\t'].join('\n'))
  const kept = (r: ReturnType<typeof sheet>) => r.rows.filter((x) => !(x.note ?? '').startsWith('【削除？】')).map((x) => x.name)
  it('N21-01 削除（確認済・検討済・生産中止・不要品・使用しないため・再設計・再利用しない）は削除（残さない）', () => {
    const del = ['削除（確認済）', '削除（検討済）', '削除（検討の結果）', '削除（生産中止）', '削除（不要品）', '削除（不要になったため）', '削除（使用しないため）', '削除（再設計のため）', '削除（NG品）', '削除（取付不可）', '削除(再利用不可)', '取外し（再利用しない）', '削除（NG品）']
    const r = sheet(del)
    expect(kept(r)).toEqual(['リレー', '端子台'])
  })
  it('N21-01 続き 削除（保留）・削除（しない）・削除（要確認）・削除（再取付）は残す', () => {
    const keep = ['削除（保留）', '削除（しない）', '削除（要確認）', '削除（検討中）', '撤去（再取付）', '取外し（再利用）', '削除→保留', '削除→再追加']
    expect(kept(sheet(keep))).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
  })
  it('N21-02 変更内容の列の「削除」も、別に備考の列があっても削除', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量\t変更内容\t備考\nリレー\tMY2N\tMY4N-D2\t4\t型式変更\t盤内\nタイマ\tH3CR-A8\t\t1\t削除\t盤内\n端子台\tXW2B-20G4\t\t4\t\t')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
  })
  it('N21-03 「そのまま」「No change」「変更なし」の行は【削除？】で聞かない', () => {
    const r = parseBomPaste('品名\t型式（旧）\t型式（新）\t数量（旧）\t数量（新）\nリレー\tMY2N\tMY4N-D2\t4\t4\nタイマ\tH3CR-A8\tそのまま\t1\tそのまま\n端子台\tXW2B-20G4\tNo change\t4\tNo change\nソケット\tPYF14A\tPYF14A\t2\t2\n電線\tVCTF\tVCTF\t10\t10')
    expect(r.rows.map((x) => (x.note ?? '').startsWith('【削除？】'))).toEqual([false, false, false, false, false])
  })
  it('N21-04 旧／新の印の無い表の「DVI→HDMI」「USB-A→USB-C」は型式のまま', () => {
    const r = parseBomPaste('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\n変換\tDVI→HDMI\tミスミ\t1\nケーブル\tUSB-A→USB-C\tサンワ\t1')
    expect(r.rows.map((x) => x.model)).toEqual(['MY4N-D2', 'DVI→HDMI', 'USB-A→USB-C'])
  })
  it('N21-05 変更区分の 取外し・廃番・x・削除(R012へ)・DEL.、見出し 変更タイプ・Change Type・修正区分', () => {
    const vals = ['取外し', '廃番', 'x', '削除(R012へ)', '削除済(Rev.2)', 'DEL.']
    const rows = ['変更区分\t品名\t型式（旧）\t型式（新）\t数量', '変更\tリレー\tMY2N\tMY4N\t4', ...vals.map((v, i) => `${v}\tD${i}\tX${i}\t\t1`), '変更なし\t端子台\tXW2B\t\t4']
    expect(parseBomPaste(rows.join('\n')).rows.map((x) => x.name)).toEqual(['リレー', '端子台'])
    for (const h of ['変更タイプ', 'Change Type', '修正区分', 'Rev区分']) {
      expect(parseBomPaste(`${h}\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N\t4\n削除\tタイマ\tH3Y\t\t1`).rows.map((x) => x.name), h).toEqual(['リレー'])
    }
  })
  it('N21-06 タブ区切りの表の上下にコンマ入りの説明の行がたくさんあっても、タブ区切りと読む', () => {
    const note = Array.from({ length: 6 }, (_, i) => `注${i}: 本表は, 盤用です`)
    const r = parseBomPaste([...note, '品名\t型式\tメーカー\t数量', 'リレー\tMY4N-D2\tオムロン\t4', 'タイマ\tH3CR\tオムロン\t2'].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ'])
  })
  it('N21-08 / U21-06 備考の「DNP 将来用」「DNP/未実装」は外す、部品名「DNP（大日本印刷）」は外さない', () => {
    const r = parseBomPaste('品名\t型式\t数量\t備考\nリレー\tA\t1\t\nB\tB\t1\tDNP 将来用\nC\tC\t1\tDNP/未実装\nD\tD\t1\tDNP製')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'D'])
    expect(parseBomPaste('品名\t型式\t数量\nDNP（大日本印刷）\tRF\t1\nリレー\tA\t1').rows.length).toBe(2)
  })
  it('N21-10 新の型式の「削除（不要）」「削除（確認済）」「削除に変更」「削除対象」「廃止予定」は型式にしない（削除）', () => {
    const vals = ['削除（不要）', '削除（確認済）', '削除に変更', '削除対象', '廃止予定', '→削除']
    const r = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量', 'リレー\tMY2N\tMY4N\t1', ...vals.map((v, i) => `D${i}\tX${i}\t${v}\t1`)].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('N21-11 見出しが「変更」で ○/× の列があるふつうの BOM は、× の部品を外さない', () => {
    const r = parseBomPaste('品名\t型式\t数量\t変更\nリレー\tA\t1\t○\nタイマ\tB\t1\t×\nランプ\tC\t1\t○')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ', 'ランプ'])
  })
})

describe('ラウンド 21 の取り込み（ベテラン）', () => {
  const sheet = (notes: string[]) => parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...notes.map((n, i) => `部品${i}\tP-${i}\t\t1\t${n}`), '端子台\tXW2B\t\t4\t'].join('\n'))
  const kept = (r: ReturnType<typeof sheet>) => r.rows.filter((x) => !(x.note ?? '').startsWith('【削除？】')).map((x) => x.name)
  const asked = (r: ReturnType<typeof sheet>) => r.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length
  it('V21-01 タブ区切りの表の上に説明の行が多く、コンマが入っていてもタブ区切りと読む', () => {
    const title = Array.from({ length: 10 }, (_, i) => `説明${i}, 盤用`)
    const parts = Array.from({ length: 8 }, (_, i) => `部品${i}\tM-${i}\tオムロン\t${i + 1}`)
    const r = parseBomPaste([...title, '品名\t型式\tメーカー\t数量', ...parts].join('\n'))
    expect(r.rows.length).toBe(8)
  })
  it('V21-02 コンマ区切りの「"」（〃）の行が続いても行をつなげない', () => {
    const r = parseBomPaste('品名,型式,メーカー,数量\nリレーA,MY4N,オムロン,1\nリレーB,MY4N,",2\nリレーC,MY4N,",3\nグランド,OA-W16 3/4",オーム電機,3')
    expect(r.rows.map((x) => x.name)).toEqual(['リレーA', 'リレーB', 'リレーC', 'グランド'])
  })
  it('V21-05 削除（予定なし）・削除（対象外）・削除（変更なし）・撤去（予定なし）は残す、削除（不要）・一部の削除は聞く', () => {
    const keep = ['削除（予定なし）', '削除（対象外）', '削除（変更なし）', '撤去（予定なし）']
    expect(kept(sheet(keep))).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
    expect(asked(sheet(['削除（不要）', '削除（一部）', '一部削除', '削除（2個中1個）']))).toBe(4)
  })
  it('V21-05 不要の為削除・不要に付き削除・全削除・一式削除 は削除', () => {
    expect(kept(sheet(['不要の為削除', '不要に付き削除', '全削除', '一式削除']))).toEqual(['リレー', '端子台'])
  })
  it('V21-06 取外し可能・撤去スペース確保 は聞かずに残す', () => {
    const notes = ['取外し可能', '撤去スペース確保', '取外し容易', '撤去場所は右側']
    const r = sheet(notes)
    expect(asked(r)).toBe(0)
    expect(r.rows.length).toBe(2 + notes.length)
  })
  it('V21-10 設変区分・Change の見出しと Del. の値', () => {
    for (const h of ['設変区分', 'Change', '対応']) {
      expect(parseBomPaste(`${h}\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N\t4\nDel.\tタイマ\tH3Y\t\t1`).rows.map((x) => x.name), h).toEqual(['リレー'])
    }
  })
})

describe('ラウンド 22 の取り込み（新人）', () => {
  const sheet = (notes: string[]) => parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...notes.map((n, i) => `部品${i}\tP-${i}\t\t1\t${n}`), '端子台\tXW2B\t\t4\t'].join('\n'))
  const kept = (r: ReturnType<typeof sheet>) => r.rows.filter((x) => !(x.note ?? '').startsWith('【削除？】')).map((x) => x.name)
  it('N22-01 削除（客先回答待ち・客先確認中・pending・under review・使用中・まだしない・削除しない予定）は残す', () => {
    const keep = ['削除（客先回答待ち）', '削除（客先確認中）', '削除（pending）', '削除（under review）', '削除（使用中）', '削除（まだしない）', '削除しない予定']
    expect(kept(sheet(keep))).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
  })
  it('N22-02 変更区分の列に 型式変更・数量変更・据え置き・継続使用・Add・No change が混ざっていても、削除を読む', () => {
    const t = ['変更区分\t品名\t型式（旧）\t型式（新）\t数量', '型式変更\tリレー\tMY2N\tMY4N\t4', '数量変更\tソケット\tPY\tPY\t2', '据え置き\t端子台\tXW2B\t\t4', '継続使用\tヒューズ\tF-1\t\t1', 'Add\tランプ\t\tL-1\t2', 'No change\tカバー\tC-1\t\t1', '削除\tタイマ\tH3Y\t\t1'].join('\n')
    expect(parseBomPaste(t).rows.map((x) => x.name)).toEqual(['リレー', 'ソケット', '端子台', 'ヒューズ', 'ランプ', 'カバー'])
  })
  it('N22-04 新の型式・変更区分の「削除（保留）」「削除（しない）」「削除予定なし」「撤去（再取付）」は削除にしない', () => {
    const r = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量', 'リレー\tMY2N\tMY4N\t1', 'A\tX1\t削除（保留）\t1', 'B\tX2\t削除予定なし\t1', 'C\tX3\t撤去（再取付）\t1'].join('\n'))
    expect(r.rows.map((x) => [x.name, x.model])).toEqual([['リレー', 'MY4N'], ['A', 'X1'], ['B', 'X2'], ['C', 'X3']])
    const k = parseBomPaste('変更区分\t品名\t型式（旧）\t型式（新）\t数量\n変更\tリレー\tMY2N\tMY4N\t4\n削除（保留）\tタイマ\tH3Y\t\t1\n削除\tランプ\tL-1\t\t1')
    expect(k.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ'])
  })
  it('N22-05 「旧→新」の見出しや変更区分の列がある表の「MY2N→MY4N-D2」は新を使う', () => {
    expect(parseBomPaste('品名\t型式（旧→新）\t数量\nリレー\tMY2N→MY4N-D2\t4').rows[0].model).toBe('MY4N-D2')
    expect(parseBomPaste('変更区分\t品名\t型式\t数量\n変更\tリレー\tMY2N→MY4N-D2\t4').rows[0].model).toBe('MY4N-D2')
  })
  it('N22-06 ふつうの BOM は、備考に「位置」「交換」「追加」とあっても型式の矢印を壊さない', () => {
    const r = parseBomPaste('品名\t型式\t数量\t備考\n変換\tDVI→HDMI\t1\t取付位置は右側\n変換\tUSB-A→USB-C\t1\t交換用')
    expect(r.rows.map((x) => x.model)).toEqual(['DVI→HDMI', 'USB-A→USB-C'])
  })
  it('N22-07 短いタブ区切りの上にコンマ入りの表題の行が多くても、タブ区切りと読む', () => {
    const title = Array.from({ length: 8 }, (_, i) => `説明${i}, 盤用, 注意`)
    const r = parseBomPaste([...title, '品名\t型式\t数量', 'リレー\tMY4N-D2\t4', 'タイマ\tH3CR\t2'].join('\n'))
    expect(r.rows.map((x) => x.name)).toEqual(['リレー', 'タイマ'])
  })
  it('N22-08 CSV で複数行セルが同じ行に 2 つあり、2 つ目の 2 行目にコンマがあっても割れない', () => {
    const csv = ['品名,型式,メーカー,備考,数量', '"リレー\n(24V)",MY4N,オムロン,"盤内\n上段, 左",4', 'タイマ,H3CR,オムロン,,2', '"ランプ\n(赤)",L-1,IDEC,"盤外\n右, 下",1'].join('\n')
    expect(parseBomPaste(csv).rows.map((x) => x.qtyNeeded)).toEqual([4, 2, 1])
  })
  it('N22-09 「全て削除」「タイマを削除」は削除', () => {
    expect(kept(sheet(['全て削除', 'タイマを削除']))).toEqual(['リレー', '端子台'])
  })
  it('N22-10 備考の「(未実装)」「※未実装」「DNP将来用」は外す', () => {
    const r = parseBomPaste('品名\t型式\t数量\t備考\nリレー\tA\t1\t\nB\tB\t1\t(未実装)\nC\tC\t1\t※未実装\nD\tD\t1\tDNP将来用')
    expect(r.rows.map((x) => x.name)).toEqual(['リレー'])
  })
  it('N22-11 ふつうの BOM の「区分」「対応」「Action」の列が × や D や 不要 だけでも、部品を消さない', () => {
    for (const h of ['区分', '対応', 'Action']) {
      const r = parseBomPaste(`品名\t型式\t数量\t${h}\nリレー\tA\t1\t×\nタイマ\tB\t1\t×\nランプ\tC\t1\t不要`)
      expect(r.rows.length, h).toBe(3)
    }
  })
})

describe('ラウンド 22 の取り込み（ベテラン）', () => {
  const sheet = (notes: string[]) => parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量\t備考', 'リレー\tMY2N\tMY4N\t1\t', ...notes.map((n, i) => `部品${i}\tP-${i}\t\t1\t${n}`), '端子台\tXW2B\t\t4\t'].join('\n'))
  const kept = (r: ReturnType<typeof sheet>) => r.rows.filter((x) => !(x.note ?? '').startsWith('【削除？】')).map((x) => x.name)
  it('V22-01 回路記号の列にコンマがたくさんある TSV もタブ区切りと読む', () => {
    const rows = Array.from({ length: 6 }, (_, i) => `部品${i}\tM-${i}\t1\tR${i}1, R${i}2, R${i}3, R${i}4, R${i}5`)
    const r = parseBomPaste(['部品名\t型式\t員数\t回路記号', ...rows].join('\n'))
    expect(r.rows.map((x) => [x.name, x.qtyNeeded])).toEqual(rows.map((_, i) => [`部品${i}`, 1]))
  })
  it('V22-02 変更区分の列に 修正・設変・New・Mod・Del が混ざっていても削除を読む', () => {
    const t = ['変更区分\t品名\t型式（旧）\t型式（新）\t数量', '修正\tA\tX1\tY1\t1', '設変\tB\tX2\tY2\t1', 'New\tC\t\tZ3\t1', 'Mod\tD\tX4\tY4\t1', 'Del\tE\tX5\t\t1'].join('\n')
    expect(parseBomPaste(t).rows.map((x) => x.name)).toEqual(['A', 'B', 'C', 'D'])
    const u = ['Action\t品名\t型式\t数量', '追加\tA\tM1\t1', 'Mod\tB\tM2\t1', 'Del\tC\tM3\t1', 'Add\tD\tM4\t1'].join('\n')
    expect(parseBomPaste(u).rows.map((x) => x.name)).toEqual(['A', 'B', 'D'])
  })
  it('V22-03 Excel の CSV で、同じ行の複数行セルが 2 つあり最初の最後の行にコンマがあっても割れない', () => {
    const csv = ['品名,型式,メーカー,備考,数量', '"リレー\n(24V, 注意)",MY4N,オムロン,"盤内\n上段, 左",4', 'タイマ,H3CR,オムロン,,2'].join('\n')
    expect(parseBomPaste(csv).rows.map((x) => x.qtyNeeded)).toEqual([4, 2])
  })
  it('V22-05 備考の「DNP 手配」「DNP 品」「DNP:RF-100」は外さない、「DNP 将来用」は外す', () => {
    const r = parseBomPaste('品名\t型式\t数量\t備考\nA\tA\t1\tDNP 手配\nB\tB\t1\tDNP 品\nC\tC\t1\tDNP:RF-100\nD\tD\t1\tDNP 将来用')
    expect(r.rows.map((x) => x.name)).toEqual(['A', 'B', 'C'])
  })
  it('V22-06 括弧の中が否定・例外（予定は無い・変更しない・継続使用・盤は残す）の削除は残す', () => {
    const keep = ['削除（予定は無い）', '削除（変更しない）', '削除（継続使用）', '削除（変更不要）', '削除（盤は残す）', '削除（R012は残す）', '削除（対象ではない）', '削除（済ではない）', '削除（未済）', '削除（完了していない）', '削除（未完了）']
    expect(kept(sheet(keep))).toEqual(['リレー', ...keep.map((_, i) => `部品${i}`), '端子台'])
  })
  it('V22-07 全て削除・全部削除・全数削除・すべて削除・この部品は削除 は削除、一部のみ削除・削除予定・Del? は聞く', () => {
    expect(kept(sheet(['全て削除', '全部削除', '全数削除', 'すべて削除', 'この部品は削除', '2台目から削除']))).toEqual(['リレー', '端子台'])
    const r = sheet(['一部のみ削除', '一部不要', '削除予定', 'Del?', '削除か'])
    expect(r.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length).toBe(5)
  })
  it('V22-08 新の型式の 削除（保留）・削除（要確認）・削除→復活 は型式にせず変えていない、不要の為削除・全削除・Rev.2で削除 は削除', () => {
    const keep = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量', 'リレー\tMY2N\tMY4N\t1', 'A\tX1\t削除（保留）\t1', 'B\tX2\t削除（要確認）\t1', 'C\tX3\t削除→復活\t1'].join('\n'))
    expect(keep.rows.map((x) => x.model)).toEqual(['MY4N', 'X1', 'X2', 'X3'])
    const del = parseBomPaste(['品名\t型式（旧）\t型式（新）\t数量', 'リレー\tMY2N\tMY4N\t1', 'A\tX1\t不要の為削除\t1', 'B\tX2\t全削除\t1', 'C\tX3\tRev.2で削除\t1'].join('\n'))
    expect(del.rows.map((x) => x.name)).toEqual(['リレー'])
  })
})
