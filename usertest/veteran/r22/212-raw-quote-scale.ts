// 囲まない「"」（〃の代わり・インチ）を何行も含む CSV で、行がつながらないか。行数・割合を変えて parseTable の行数を比べる。
import { parseTable } from './h22.ts'
const hdr = '部品名,型式,メーカ,数量,備考'
const mk = (n: number, o: { ditto?: number; inch?: number; ml?: number; commaMaker?: number }) => {
  const L = [hdr]
  for (let i = 0; i < n; i++) {
    const d = o.ditto && (i * 7919) % 100 < o.ditto * 100 && i > 0
    const inch = o.inch && (i * 104729) % 100 < o.inch * 100
    const ml = o.ml && (i * 1299709) % 100 < o.ml * 100
    const cm = o.commaMaker && (i * 15485863) % 100 < o.commaMaker * 100
    L.push(`部品${i},${inch ? '3/4"' : `M-${i}`},${d ? '"' : cm ? '"Omron, Inc."' : 'オムロン'},${i},${ml ? '"a, b\nc"' : ''}`)
  }
  return L.join('\n')
}
const variants: Array<[string, any]> = [
  ['ditto 30%', { ditto: 0.3 }], ['ditto 70%', { ditto: 0.7 }], ['ditto 100%', { ditto: 1 }],
  ['inch 30%', { inch: 0.3 }], ['inch 100%', { inch: 1 }],
  ['ditto 70% + inch 100%', { ditto: 0.7, inch: 1 }],
  ['ditto 30% + ml 5%', { ditto: 0.3, ml: 0.05 }], ['ditto 70% + ml 10%', { ditto: 0.7, ml: 0.1 }],
  ['inch 30% + ml 10%', { inch: 0.3, ml: 0.1 }],
  ['ditto 30% + commaMaker 30%', { ditto: 0.3, commaMaker: 0.3 }], ['ditto 30% + commaMaker 30% + ml 10%', { ditto: 0.3, commaMaker: 0.3, ml: 0.1 }],
  ['commaMaker 100% + ml 10% (Excel形式)', { commaMaker: 1, ml: 0.1 }],
]
console.log('variant'.padEnd(40) + [10, 50, 300, 2500].map((n) => String(n).padStart(14)).join(''))
for (const [name, o] of variants) {
  let line = name.padEnd(40)
  for (const n of [10, 50, 300, 2500]) {
    const got = parseTable(mk(n, o), ',').length
    line += `${got === n + 1 ? 'ok' : 'NG'} ${got}/${n + 1}`.padStart(14)
  }
  console.log(line)
}
