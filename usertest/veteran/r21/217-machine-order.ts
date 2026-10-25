// 号機ごとの旧／新で、新の列の並びが旧と違う・旧の値が号機ごとに違うとき、空の新の号機に対になる旧の号機を足しているか（列の順で対にしていないか）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const T = (rows: any[][]) => rows.map((r) => r.join('\t')).join('\n')
const run = (name: string, hdr: string[], row: any[], expect: number) => {
  const r = parseBomPaste(T([['部品名', '型式', ...hdr], ['リレー', 'MY4N', ...row], ['端子台', 'XW2B', ...row.map(() => 1)]]))
  const got = (r.rows as any[])[0].qtyNeeded
  console.log(`${got === expect ? 'ok ' : 'NG '} ${name.padEnd(46)} expect=${expect} got=${got}`)
}
// 旧1=6 旧2=2 旧3=1。新1 空、新2=9、新3 空 → 6 + 9 + 1 = 16
run('順: 旧1 旧2 旧3 新1 新2 新3', ['旧1号機', '旧2号機', '旧3号機', '新1号機', '新2号機', '新3号機'], [6, 2, 1, '', 9, ''], 16)
run('新の逆順: 旧1 旧2 新2 新1', ['旧1号機', '旧2号機', '新2号機', '新1号機'], [6, 2, 9, ''], 15)
run('新と旧が交互: 旧1 新1 旧2 新2', ['旧1号機', '新1号機', '旧2号機', '新2号機'], [6, '', 2, 9], 15)
run('旧が逆順: 旧2 旧1 新1 新2', ['旧2号機', '旧1号機', '新1号機', '新2号機'], [2, 6, '', 9], 15)
run('旧が逆順(新1が空): 旧2 旧1 新1 新2', ['旧2号機', '旧1号機', '新1号機', '新2号機'], [2, 6, 7, ''], 9)
run('A/B 旧B 旧A 新A 新B (新A 空)', ['旧B号機', '旧A号機', '新A号機', '新B号機'], [2, 6, '', 9], 15)
