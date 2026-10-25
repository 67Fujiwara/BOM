// 〃の代わりの「"」だけを書いた自然な表（手書き・古い ERP の CSV / TSV）。行数が合うか。
import { parseTable, parseBomPaste } from './h21.ts'
const cases: Array<[string, string, ',' | '\t', number]> = [
  ['ditto-all 連続', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\n",",",2\n",",",3\n', ',', 4],
  ['ditto name+model 連続', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\n",",ミスミ,2\n",",IDEC,3\n', ',', 4],
  ['ditto maker だけ連続', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nタイマ,H3CR,",2\nソケット,PYF,",3\n', ',', 4],
  ['ditto maker が飛び飛び', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nタイマ,H3CR,",2\nソケット,PYF,IDEC,3\nヒューズ,F-1,",5\n', ',', 5],
  ['ditto maker + 次の行 ditto model/maker', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nタイマ,H3CR,",2\nソケット,",",3\n', ',', 4],
  ['ditto maker + 次の行 model が 3/4"', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nパイプ,M-2,",2\nホース,3/4",",3\n', ',', 4],
  ['ditto maker + 次の行 name に 1/2"', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\nタイマ,H3CR,",2\nパイプ 1/2",P-1,",3\n', ',', 4],
  ['TSV ditto-all 連続', '部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t4\n"\t"\t"\t2\n"\t"\t"\t3\n', '\t', 4],
  ['TSV ditto maker + 次の行 ditto model/maker', '部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t4\nタイマ\tH3CR\t"\t2\nソケット\t"\t"\t3\n', '\t', 4],
  ['TSV inch + ditto', '部品名\t型式\tメーカ\t数量\nリレー\tMY4N\tオムロン\t4\nパイプ\t3/4"\t"\t2\nホース\t3/4"\t"\t3\n', '\t', 4],
  ['ditto 備考 + 次の行 ditto 備考', '部品名,型式,メーカ,数量,備考\nリレー,MY4N,オムロン,4,盤内\nタイマ,H3CR,オムロン,2,"\nソケット,PYF,オムロン,3,"\n', ',', 4],
  ['ditto 備考 + 次の行 3/4"', '部品名,型式,メーカ,数量,備考\nリレー,MY4N,オムロン,4,盤内\nタイマ,H3CR,オムロン,2,"\nホース,3/4",オムロン,3,\n', ',', 4],
  ['ditto 数量以外全部 5 行', '部品名,型式,メーカ,数量\nリレー,MY4N,オムロン,4\n",",",1\n",",",2\n",",",3\n",",",4\n', ',', 6],
]
let bad = 0
for (const [id, text, d, rows] of cases) {
  const got = parseTable(text, d).length
  const pr = parseBomPaste(text)
  const ok = got === rows
  if (!ok) bad++
  console.log(`${ok ? 'ok ' : 'NG '} ${id.padEnd(38)} rows exp=${rows} got=${got} bom=${pr.rows.length} ${ok ? '' : JSON.stringify(parseTable(text, d).map((r) => r.join('|')).slice(0, 5))}`)
}
console.log('bad', bad, '/', cases.length)
