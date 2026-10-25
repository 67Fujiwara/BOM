const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const n = Number(process.env.NN ?? 200000)
for (const [name, cell] of [['model x+空白+y', `x${' '.repeat(n)}y`], ['plain control', `x${'a'.repeat(n)}y`]] as Array<[string, string]>) {
  const text = `部品名\t型式\t数量\nリレー\t${cell}\t1\n端子台\tXW2B\t2\n`
  const t0 = performance.now(); const r = parseBomPaste(text); console.log(JSON.stringify({ n, name, ms: Math.round(performance.now() - t0), rows: r.rows.length }))
}
