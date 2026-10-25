// ラウンド23: 見出しの語で先に決める（headerHit）が効かない形：見出し無し・見出しが未知の語・見出し 1 語・両方の区切りで見出しが見える・EDA・UTF-16 を想定した改行
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const refs = (i: number, k: number) => Array.from({ length: k }, (_, j) => `R${i * 10 + j}`).join(', ')
const rep = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i + 1))
const T = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')
const C = (rows: string[][]) => rows.map((r) => r.join(',')).join('\n')
type S = { id: string; text: string; exp: number; delim: string; note: string }
const S: S[] = []
const add = (id: string, note: string, text: string, exp: number, delim: string) => S.push({ id, note, text, exp, delim })
for (const k of [2, 3, 4, 5, 8]) {
  add(`H1-nohead-tsv-refs${k}`, `見出し無し TSV 4 列（部品名・型式・数量・回路記号にコンマ ${k - 1} 個）`, T(rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, k)])), 10, 'tab')
  add(`H2-unknownhead-tsv-refs${k}`, `未知の見出し（Part/Code/Pcs/Refs）TSV 回路記号にコンマ ${k - 1} 個`, T([['Part', 'Code', 'Pcs', 'Refs'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, k)])]), 10, 'tab')
  add(`H3-onehead-tsv-refs${k}`, `見出し 1 語のみ認識（数量）TSV`, T([['A', 'B', '数量', 'D'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, k)])]), 10, 'tab')
}
add('H4-both-hit', '両方に見出しが見える: 表題行に「品名, 数量, 納期」、TSV の見出しに回路記号', T([['品名, 数量, 納期'], ['部品名', '型式', '員数', '回路記号'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 5)])]), 10, 'tab')
add('H5-both-hit-csv', '両方に見出しが見える CSV: 見出し行 CSV、備考にタブ区切りの「部品名\\t数量」を 12 行', C([['部品名', '型式', '数量', '備考'], ...rep(12, (i) => [`部品${i}`, `M-${i}`, '1', '部品名\t数量'])]), 12, 'comma')
add('H6-tsv-header-in-comma-title', 'TSV（ヘッダなし）で 1 行目がコンマ区切りの見出し風「部品名, 型式, 数量」', ['部品名, 型式, 数量', ...rep(10, (i) => T([[`部品${i}`, `M-${i}`, '1', refs(i, 4)]]))].join('\n'), 10, 'tab')
add('H7-csv-header-tab-title', 'CSV で表題がタブ区切りの見出し風「部品名\\t型式\\t数量」', ['部品名\t型式\t数量', C([['部品名', '型式', '数量', '備考']]), ...rep(10, (i) => C([[`部品${i}`, `M-${i}`, '1', 'a']]))].join('\n'), 10, 'comma')
add('H8-kicad-csv-tabs-desc', 'KiCad 風 CSV（引用符あり）。Description にタブ', ['"Refs","Value","Footprint","Qty"', ...rep(10, (i) => `"R${i}, R${i + 100}","10k\tinline","R_0603",2`)].join('\n'), 10, 'comma')
add('H9-altium-tsv', 'Altium 風 TSV。Designator に「R1, R2, R3」、Comment/Description/Quantity', T([['Comment', 'Description', 'Designator', 'Quantity'], ...rep(10, (i) => ['10k', '抵抗, 1/10W, 1%', refs(i, 3), '3'])]), 10, 'tab')
add('H10-tsv-semicolon-pt', '空の見出し行（タブだけ）の次に TSV', '\t\t\t\n' + T([['部品名', '型式', '数量', '回路記号'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 5)])]), 10, 'tab')
add('H11-tsv-crlf-bom', 'BOM つき(U+FEFF)・CRLF の TSV', '﻿' + T([['部品名', '型式', '数量', '回路記号'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 5)])]).replace(/\n/g, '\r\n'), 10, 'tab')
add('H12-csv-semicolon', 'セミコロン区切り（欧州 Excel）。', [['部品名', '型式', '数量'].join(';'), ...rep(5, (i) => [`部品${i}`, `M-${i}`, '1'].join(';'))].join('\n'), 5, 'none')
add('H13-tsv-ragged-commas', 'TSV: 列数ばらばら（3〜6）で全行コンマ 5 つのセルが 1 つ', T([['部品名', '型式', '数量', '備考'], ...rep(12, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 6), ...Array(i % 3).fill('x')])]), 12, 'tab')
add('H14-tsv-trailing-tab', 'TSV: 各行末にタブ（空の列）、回路記号コンマ 4', T([['部品名', '型式', '数量', '回路記号', ''], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 5), ''])]), 10, 'tab')
add('H15-tsv-1col-name-comma', 'TSV 2 列: 見出しは 2 語、データは名前にコンマ多数だけ(型式列は空)', T([['部品名', '型式'], ...rep(10, (i) => [`抵抗, ${i}, a, b, c, d`, ''])]), 10, 'tab')
add('H16-tsv-multiline-quoted-refs', 'TSV: 回路記号が引用符つき複数行、他の行は 1 行', T([['部品名', '型式', '数量', '回路記号'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', i % 2 ? `"${refs(i, 3)}\n${refs(i, 3)}"` : refs(i, 3)])]), 10, 'tab')
add('H17-tsv-title-lines-many', 'TSV: 表題 20 行（コンマ入り、見出しの語を含む「品名, 数量」）＋見出し＋10 行', [...rep(20, (i) => `品名, 数量, 項目${i}`), T([['部品名', '型式', '数量', '回路記号'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', refs(i, 5)])])].join('\n'), 10, 'tab')
add('H18-csv-title-lines-tabs', 'CSV: 表題 20 行（タブ入り、見出しの語を含む「品名\\t数量」）＋見出し＋10 行', [...rep(20, (i) => `品名\t数量\t項目${i}`), C([['部品名', '型式', '数量', '備考'], ...rep(10, (i) => [`部品${i}`, `M-${i}`, '1', 'a'])])].join('\n'), 10, 'comma')
const out: any[] = []
for (const s of S) {
  const t0 = performance.now()
  const r = parseBomPaste(s.text)
  const names = r.rows.map((x: any) => x.name)
  const ok = r.rows.length === s.exp && r.delimiter === s.delim && names.every((n: string) => /^部品|^抵抗/.test(n || ''))
  out.push({ id: s.id, ok, n: r.rows.length, delim: r.delimiter, sample: names.slice(0, 3), ms: Math.round(performance.now() - t0), w: r.warnings.map((w) => w.slice(0, 50)) })
  console.log(`${ok ? 'ok' : 'NG'}  ${s.id.padEnd(34)} exp=${s.delim}/${s.exp} got=${r.delimiter}/${r.rows.length} names=${names.slice(0, 2).join('|')}`)
}
console.log('NG', out.filter((o) => !o.ok).length, '/', out.length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/307-delim-shapes' + (process.env.TAG ?? '') + '.json', JSON.stringify({ out, S }, null, 1))
