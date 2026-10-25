// ラウンド20: 書き写し（新＝旧）の行 c と、新が空の行 e の組み合わせごとに、空の行が「削除／【削除？】／黙って残す」のどれになるか（型式 1 項目・型式と数量の 2 項目）。変更した行は 10 行足す
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const out: any = { one: {}, two: {} }
const C = [1, 2, 3, 5, 10, 30, 100], E = [1, 2, 5, 10, 30, 100, 300]
for (const kind of ['one', 'two'] as const) {
  console.log(kind === 'one' ? '== 型式 1 項目（行: 書き写し c、列: 空 e）D=削除 ?=【削除？】 .=黙って残す' : '== 型式・数量 2 項目')
  console.log('c\\e ' + E.map((e) => String(e).padStart(4)).join(''))
  for (const c of C) {
    let line = String(c).padStart(3) + ' '
    for (const e of E) {
      const rows: string[][] = [kind === 'one' ? ['部品名', '型式', '変更後型式', '数量'] : ['部品名', '型式', '変更後型式', '数量', '変更後数量']]
      let k = 0
      for (let i = 0; i < 10; i++) { k++; rows.push(kind === 'one' ? [`部品${k}`, `O-${k}`, `N-${k}`, '1'] : [`部品${k}`, `O-${k}`, `N-${k}`, '1', '2']) }
      for (let i = 0; i < c; i++) { k++; rows.push(kind === 'one' ? [`部品${k}`, `O-${k}`, `O-${k}`, '1'] : [`部品${k}`, `O-${k}`, `O-${k}`, '1', '1']) }
      const first = k + 1
      for (let i = 0; i < e; i++) { k++; rows.push(kind === 'one' ? [`部品${k}`, `O-${k}`, '', '1'] : [`部品${k}`, `O-${k}`, '', '1', '']) }
      const r = parseBomPaste(rows.map((x) => x.join('\t')).join('\n'))
      const em = (r.rows as any[]).filter((x) => Number(/\d+/.exec(x.name)![0]) >= first)
      const mark = em.length === 0 ? 'D' : em.every((x) => String(x.note ?? '').startsWith('【削除？】')) ? '?' : '.'
      line += mark.padStart(4)
      out[kind][`${c},${e}`] = mark
    }
    console.log(line)
  }
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r21/175-threshold-grid' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
