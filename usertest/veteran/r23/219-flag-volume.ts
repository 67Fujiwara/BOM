// 【削除？】の量: 2,500 行の変更表（変えた行だけ書く）。備考の p% が普通の注記（取外し可能・撤去スペース確保…）のとき、何行に【削除？】が付くか。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const NOISY = ['取外し可能', '撤去スペース確保', '廃止品番に注意', '削除ではない', '取外し箇所は図面参照', '撤去履歴あり', '取外し治具', '削除は行わない', '削除しなくてよい', '撤去機構']
const OK = ['盤内', '要予備', '取外し時注意', '撤去用ブラケット', '削除は次回', '新規', '位置変更']
for (const p of [0.01, 0.05, 0.1]) {
  const rows = ['部品名\t旧型式\t新型式\t数量\t備考']
  let k = 0
  for (let i = 1; i <= 2500; i++) {
    const r = (i * 2654435761) % 1000 / 1000
    const changed = i % 10 === 0
    const note = r < p ? NOISY[i % NOISY.length] : r < p + 0.2 ? OK[i % OK.length] : ''
    if (r < p && !changed) k++
    rows.push(`部品${i}\tOLD-${i}\t${changed ? 'NEW-' + i : ''}\t1\t${note}`)
  }
  const c0 = process.cpuUsage(); const res = parseBomPaste(rows.join('\n')); const c1 = process.cpuUsage(c0)
  const flagged = (res.rows as any[]).filter((x) => String(x.note ?? '').startsWith('【削除？】')).length
  console.log(`p=${p}: noisy notes on unchanged rows=${k} rows=${res.rows.length} flagged=${flagged} cpuMs=${Math.round((c1.user + c1.system) / 1000)}`)
}
