// 区切り・ページ表題の行の正規表現（isSectionLine の「部品表 … 2/3」など）の時間。1 セルだけの行（表題・区切り）に長い繰り返し。CPU ms。n = 5000 / 10000 / 20000 / 40000
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste, isSectionLine, isTotalCell } = await import(SRC + '/io/paste.ts')
const pre = ['部品表', '制御盤A 部品表 ', 'BOM ', 'Parts List ', '部品表 (', '合計', '計', '以上', '以下余白', '■', '1.', '<', '＜']
const suf: Array<[string, (n: number) => string]> = [['1×n', (n) => '1'.repeat(n)], ['1空白×n/2', (n) => '1 '.repeat(n / 2)], ['空白×n+x', (n) => ' '.repeat(n) + 'x'], ['1/×n/2', (n) => '1/'.repeat(n / 2)], ['(1×n/2', (n) => '(1'.repeat(n / 2)], ['p.×n/2', (n) => 'p.'.repeat(n / 2)], ['of×n', (n) => 'of'.repeat(n / 2)], ['続き×n', (n) => '続き'.repeat(n / 2)], ['全角空白×n', (n) => '　'.repeat(n) + 'x']]
const rows: any[] = []
for (const p of pre) for (const [sn, f] of suf) {
  const ms: Record<number, number> = {}
  for (const n of [5000, 10000, 20000, 40000]) {
    const cell = p + f(n)
    const text = ['部品名\t型式\t数量', cell, 'A\tM-1\t2'].join('\n')
    const c0 = process.cpuUsage(); parseBomPaste(text); isSectionLine([cell, '', ''], 3); isTotalCell(cell); const c1 = process.cpuUsage(c0)
    ms[n] = Math.round((c1.user + c1.system) / 1000)
    if (ms[n] > 3000) break
  }
  const worst = Math.max(...Object.values(ms))
  console.log(JSON.stringify({ p, sn, ms }))
  if (worst > 150) rows.push({ p, sn, ms })
}
console.log('done slow=', rows.length)
