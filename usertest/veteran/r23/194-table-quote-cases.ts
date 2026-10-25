// parseTable の手書きの形（囲みの外の数え方・〃の「"」・インチ・表題・コンマ入り囲み・複数行セル）。期待のセル数つき。
import fs from 'node:fs'
import { parseTable, parseBomPaste } from './h22.ts'
const D = ','
type C = { id: string; note: string; text: string; rows: number; cols?: number[]; find?: string }
const hdr = '部品名,型式,メーカ,数量,備考'
const C: C[] = [
  { id: 'Q01-inch-raw-then-ml', note: '型式に囲まない 3/4"、同じ行の備考が囲んだ複数行', text: `${hdr}\nパイプ,3/4",オムロン,1,"1行目\n2行目"\n端子台,XW2B,オムロン,2,\n`, rows: 3 },
  { id: 'Q02-inch-raw-after-ml-row', note: '複数行セルの行のあとの行に 3/4"', text: `${hdr}\nパイプ,XW2B,オムロン,1,"1行目\n2行目"\nホース,3/4",オムロン,2,\n`, rows: 3 },
  { id: 'Q03-inch-raw-two-then-ml', note: '3/4" が 2 つ（型式と備考の前）＋複数行', text: `${hdr}\n3/4"パイプ,3/4",オムロン,1,"a\nb"\nX,Y,Z,2,\n`, rows: 3 },
  { id: 'Q04-ditto-quote-then-ml', note: 'メーカの「"」（囲まない）＋同じ行の備考が複数行', text: `${hdr}\nA,M-1,オムロン,1,\nB,M-2,",2,"1行目\n2行目"\nC,M-3,",3,\n`, rows: 4 },
  { id: 'Q05-ditto-quote-ml-prev', note: '複数行セルの行の次の行にメーカ「"」', text: `${hdr}\nA,M-1,オムロン,1,"1行目\n2行目"\nB,M-2,",2,\n`, rows: 3 },
  { id: 'Q06-ditto-in-name-col0', note: '部品名が「"」の行', text: `${hdr}\nリレー,M-1,オムロン,1,\n",M-2,オムロン,2,\n",M-3,オムロン,3,\n`, rows: 4 },
  { id: 'Q07-ditto-last-col', note: '最後の列（備考）が「"」', text: `${hdr}\nリレー,M-1,オムロン,1,盤内\nB,M-2,オムロン,2,"\nC,M-3,オムロン,3,"\n`, rows: 4 },
  { id: 'Q08-ml-comma5-in-width4', note: '中のコンマが区切りの数より多い複数行（Excel の囲み）', text: `${hdr}\nA,M-1,オムロン,1,"a, b, c, d, e, f\ng"\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q09-ml-comma-list-and-ditto', note: '中のコンマの多い複数行＋別の行の「"」', text: `${hdr}\nA,M-1,オムロン,1,"a, b, c, d, e, f\ng"\nB,M-2,",2,\n`, rows: 3 },
  { id: 'Q10-title-nocomma-many', note: 'コンマの無い表題 5 行＋複数行セル＋コンマ入りの囲み', text: `部品表\n制御盤A\n2026-10-25\n山田\n以上\n${hdr}\nA,M-1,"Omron, Inc.",1,"x\ny"\nB,M-2,オムロン,2,\n`, rows: 8 },
  { id: 'Q11-title-with-commas', note: '表題にコンマ（作成,山田,承認,鈴木）', text: `作成,山田,承認,鈴木\n${hdr}\nA,M-1,オムロン,1,"x\ny"\nB,M-2,オムロン,2,\n`, rows: 4 },
  { id: 'Q12-all-quoted', note: 'すべて囲んだ CSV（引用符あり）、複数行セル、コンマ', text: `"部品名","型式","メーカ","数量","備考"\n"A","M-1","Omron, Inc.","1","a, b, c\nd"\n"B","M-2","オムロン","2",""\n`, rows: 3 },
  { id: 'Q13-ml-two-in-row', note: '同じ行に複数行セルが 2 つ（名称と備考）', text: `${hdr}\n"リレー\nA",M-1,オムロン,1,"x\ny"\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q14-ml-first-col', note: '部品名が複数行、メーカにコンマ入り', text: `${hdr}\n"リレー\nA, B",M-1,"Omron, Inc.",1,\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q15-inch-in-quoted', note: '囲んだセルの中のインチ（"3/4"" 形）＋複数行', text: `${hdr}\nA,"3/4""",オムロン,1,"1行目\n2行目"\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q16-start-quote-text', note: '「"」で始まる文字（"特注"品）を囲まずに書いた', text: `${hdr}\n"特注"品,M-1,オムロン,1,\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q17-start-quote-text-ml', note: '「"特注"品」＋別の行の複数行セル', text: `${hdr}\n"特注"品,M-1,オムロン,1,\nB,M-2,オムロン,2,"x\ny"\n`, rows: 3 },
  { id: 'Q18-ditto-pair-adjacent-cols', note: '「"」が横に 2 つ並ぶ（メーカ・数量）', text: `${hdr}\nA,M-1,オムロン,1,\nB,M-2,",",\nC,M-3,",",\n`, rows: 4 },
  { id: 'Q19-quote-space-text', note: 'セルが「" 」（引用符＋空白）', text: `${hdr}\nA,M-1,オムロン,1,\nB,M-2," ,2,\nC,M-3," ,3,\n`, rows: 4 },
  { id: 'Q20-many-inner-commas-width-high', note: '10 列の表で、中のコンマ 15 の複数行セル', text: `a,b,c,d,e,f,g,h,i,j\n1,2,3,4,5,6,7,8,9,"x1, x2, x3, x4, x5, x6, x7, x8\nx9, x10, x11, x12, x13, x14, x15"\n1,2,3,4,5,6,7,8,9,10\n`, rows: 3 },
  { id: 'Q21-ml-mid-col-then-more-cells', note: '備考が途中の列で、複数行のあとにまだ列がある（Excel の CSV）', text: `部品名,備考,型式,数量\nA,"x, y\nz",M-1,1\nB,,M-2,2\n`, rows: 3 },
  { id: 'Q22-crlf-ml', note: 'CRLF の改行＋複数行セル（CR LF がセルの中）', text: `${hdr}\r\nA,M-1,オムロン,1,"x\r\ny"\r\nB,M-2,オムロン,2,\r\n`, rows: 3 },
  { id: 'Q23-no-trailing-newline-quote', note: '最後のセルが閉じない「"」', text: `${hdr}\nA,M-1,オムロン,1,"x\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q24-quote-in-middle-unquoted', note: 'セルの途中の「"」（囲まない）が複数行', text: `${hdr}\nA,M-1,オ"ムロン,1,\nB,M-2,オ"ムロン,2,\nC,M-3,x,3,\n`, rows: 4 },
  { id: 'Q25-only-quotes-line', note: '「"」だけの行', text: `${hdr}\nA,M-1,オムロン,1,\n"\nB,M-2,オムロン,2,\n`, rows: 4 },
  { id: 'Q26-ditto-then-ml-same-line-closing', note: '「"」→次行が複数行の閉じ（"…\\n…"）を含む', text: `${hdr}\nA,M-1,",1,"a\nb"\nB,M-2,",2,"c\nd"\n`, rows: 3 },
  { id: 'Q27-outside-count-quoted-in-before', note: '同じ行の前に「囲んだセル2つ」＋ML（outside 数えの確認）', text: `${hdr}\n"A, 1","M, 1","Omron, Inc.",1,"x\ny"\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q28-ml-after-row-with-escaped-quotes', note: '前のセルに "" のエスケープ', text: `${hdr}\n"A ""x"", y",M-1,オムロン,1,"p\nq"\nB,M-2,オムロン,2,\n`, rows: 3 },
  { id: 'Q29-tsv-ish-in-csv', note: '値の中に全角コンマ・読点は区切りにしない', text: `${hdr}\nA、B,M-1,オムロン，Inc,1,x\n`, rows: 2 },
  { id: 'Q30-ml-width-by-quoted-only', note: '全行に複数行セル（引用符なしの行が見出しだけ）', text: `${hdr}\nA,M-1,オムロン,1,"p, q\nr"\nB,M-2,オムロン,2,"p, q\nr"\nC,M-3,オムロン,3,"p, q\nr"\n`, rows: 4 },
  { id: 'Q31-raw-ditto-and-ml-commas-same-row', note: '同じ行に囲まない「"」（メーカ）と、中のコンマが 4 つの複数行セル', text: `${hdr}\nA,M-1,オムロン,1,\nB,M-2,",2,"a, b, c, d, e\nf"\nC,M-3,オムロン,3,\n`, rows: 4 },
  { id: 'Q32-raw-inch-and-ml-commas-same-row', note: '同じ行に囲まない 3/4"（型式）と、中のコンマが 4 つの複数行セル', text: `${hdr}\nA,M-1,オムロン,1,\nパイプ,3/4",オムロン,2,"a, b, c, d, e\nf"\nC,M-3,オムロン,3,\n`, rows: 4 },
  { id: 'Q33-raw-inch-and-ml-commas3-same-row', note: '同上、中のコンマ 3（区切りの数 4 より少ない）', text: `${hdr}\nA,M-1,オムロン,1,\nパイプ,3/4",オムロン,2,"a, b, c, d\nf"\nC,M-3,オムロン,3,\n`, rows: 4 },
  { id: 'Q34-excel-inch-quoted-and-ml-commas', note: 'Excel 形式（"3/4"""）＋中のコンマ 5 の複数行', text: `${hdr}\nA,M-1,オムロン,1,\nパイプ,"3/4""",オムロン,2,"a, b, c, d, e, f\ng"\nC,M-3,オムロン,3,\n`, rows: 4 },
  { id: 'Q35-inch-raw-in-name-then-ml-prefix', note: '部品名の途中に 1/2"（囲まない）＋同行の複数行（コンマ5）', text: `${hdr}\nパイプ 1/2" 長尺,M-1,オムロン,1,"a, b, c, d, e, f\ng"\nC,M-3,オムロン,3,\n`, rows: 3 },
]
const out: any[] = []
let bad = 0
for (const c of C) {
  const got = parseTable(c.text.replace(/\r\n/g, '\n'), D)
  const pr = parseBomPaste(c.text)
  const rowsOk = got.length === c.rows
  if (!rowsOk) bad++
  const rec = { id: c.id, note: c.note, expectRows: c.rows, gotRows: got.length, ok: rowsOk, cells: got.map((r) => r.map((x) => x.slice(0, 14)).join('|')).slice(0, 10), bomRows: pr.rows.length }
  out.push(rec); console.log(`${rowsOk ? 'ok ' : 'NG '} ${c.id} exp=${c.rows} got=${got.length} bom=${pr.rows.length} ${rowsOk ? '' : JSON.stringify(rec.cells)}`)
}
console.log('bad', bad, '/', C.length)
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/194-table-quote-cases${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
