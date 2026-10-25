// 行数に対する時間（CPU ms）。2,500 / 10,000 / 40,000 / 100,000 行で、普通の表・変更区分あり（半分が削除）・DNP 列あり・変更表（半分が空）・
// 引用符つき CSV（コンマ入りメーカ・複数行の備考が 10%）・〃だらけの表。二乗になる処理（gone.includes など）を探す。
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, parseTable } = await import(SRC + '/io/paste.ts')
const sizes = (process.env.SIZES ?? '2500,10000,40000,100000').split(',').map(Number)
const T = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')
const mk: Record<string, (n: number) => string> = {
  ordinary: (n) => T([['部品名', '型式', 'メーカ', '数量', '備考'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, `M-${i}`, 'オムロン', String(i % 9 + 1), ''])]),
  kindHalfDeleted: (n) => T([['変更区分', '部品名', '型式', '数量'], ...Array.from({ length: n }, (_, i) => [i % 2 ? '削除' : '追加', `部品${i}`, `M-${i}`, '1'])]),
  dnpHalf: (n) => T([['部品名', '型式', '数量', 'DNP'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, `M-${i}`, '1', i % 2 ? 'DNP' : ''])]),
  changeHalfBlank: (n) => T([['部品名', '旧型式', '新型式', '数量', '備考'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, `O-${i}`, i % 2 ? '' : `N-${i}`, '1', i % 4 === 1 ? '削除' : ''])]),
  changeCopyDel: (n) => T([['部品名', '旧型式', '新型式', '数量'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, `O-${i}`, i % 3 === 0 ? '' : i % 3 === 1 ? `O-${i}` : `N-${i}`, '1'])]),
  dittoHeavy: (n) => T([['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, i % 2 ? '〃' : `M-${i}`, '〃', '1'])]),
  csvQuoted: (n) => ['部品名,型式,メーカ,数量,備考', ...Array.from({ length: n }, (_, i) => `部品${i},M-${i},"Omron, Inc.",1,${i % 10 === 0 ? '"a, b\nc"' : ''}`)].join('\n'),
  csvRawQuote: (n) => ['部品名,型式,メーカ,数量,備考', ...Array.from({ length: n }, (_, i) => `部品${i},3/4",${i % 3 ? '"' : 'オムロン'},1,${i % 50 === 0 ? '"a, b\nc"' : ''}`)].join('\n'),
  machines: (n) => T([['部品名', '型式', '旧1号機', '旧2号機', '新1号機', '新2号機'], ...Array.from({ length: n }, (_, i) => [`部品${i}`, `M-${i}`, '6', '6', i % 2 ? '7' : '', ''])]),
}
const out: any[] = []
for (const [name, f] of Object.entries(mk)) {
  const row: any = { name, ms: {} }
  for (const n of sizes) {
    const text = f(n)
    const c0 = process.cpuUsage(); const r = parseBomPaste(text); const c1 = process.cpuUsage(c0)
    row.ms[n] = Math.round((c1.user + c1.system) / 1000); row['rows' + n] = r.rows.length
    if (row.ms[n] > 20000) break
  }
  out.push(row); console.log(JSON.stringify(row))
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/209-rowscale${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
