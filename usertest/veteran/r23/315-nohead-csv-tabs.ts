// ラウンド23: 見出し無し(または未知の見出し)の CSV で、備考などにタブが入っているとき consistency×2 でタブ区切りに倒れないか
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const out: string[] = []
for (const ncols of [3, 4, 5, 6, 8]) for (const tabs of [1, 2, 3, 5]) for (const head of ['none', 'unknown', 'known']) for (const frac of [1, 0.6]) {
  const rows: string[] = []
  const hdr = head === 'known' ? ['部品名', '型式', '数量', 'メーカ', '単位', '備考', 'a', 'b'] : ['Part', 'Code', 'Pcs', 'Brand', 'U', 'Memo', 'a', 'b']
  if (head !== 'none') rows.push(hdr.slice(0, ncols).join(','))
  for (let i = 0; i < 20; i++) {
    const c = [`部品${i}`, `M-${i}`, '1', 'オムロン', '個', 'メモ', 'x', 'y'].slice(0, ncols)
    if (i / 20 < frac) c[ncols - 1] = Array.from({ length: tabs + 1 }, (_, k) => 't' + k).join('\t')
    rows.push(c.join(','))
  }
  const r = parseBomPaste(rows.join('\n'))
  const nExp = 20
  const ok = r.delimiter === 'comma' && r.rows.length === nExp
  out.push(`${ok ? 'ok' : 'NG'} cols=${ncols} tabs/row=${tabs} head=${head} frac=${frac} -> ${r.delimiter}/${r.rows.length}`)
}
console.log(out.join('\n'))
console.log('NG', out.filter((o) => o.startsWith('NG')).length, '/', out.length)
