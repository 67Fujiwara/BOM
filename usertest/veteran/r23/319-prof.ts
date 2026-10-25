const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const n = 80000
const R = (s: string) => s.repeat(Math.floor(n / s.length))
const text = ['部品名\t' + R('",') + '\t数量', 'A\tM-1\t1'].join('\n')
const c0 = process.cpuUsage(); parseBomPaste(text); const c1 = process.cpuUsage(c0)
console.log('header",xn', Math.round((c1.user + c1.system) / 1000), 'ms')
const t2 = ['部品名,型式,メーカ,数量,備考', `A,M-1,オムロン,1,${R(',')}`, `B,M-2,${R('",')},2,`, 'C,M-3,x,3,'].join('\n')
const c2 = process.cpuUsage(); parseBomPaste(t2); const c3 = process.cpuUsage(c2)
console.log('csv-quoted', Math.round((c3.user + c3.system) / 1000), 'ms')
