// ラウンド20: r19 で足した「旧→新」の正規表現 /^[^→⇒]+\s*(→|⇒|->|＞|>)\s*[^→⇒]+$/ は [^→⇒]+ と \s* が空白を取り合う。矢印の無い長い空白入りのセルで遅くならないか（型式・メーカ・数量のセル）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const out: unknown[] = []
for (const n of [1000, 5000, 20000, 40000]) {
  for (const [name, mk] of [
    ['model: x+空白n+y', (n: number) => `x${' '.repeat(n)}y`],
    ['model: 空白n+x', (n: number) => `${' '.repeat(n)}x`.replace(/^ +/, 'a ') + ' '.repeat(n) + 'z'],
    ['qty: 1+空白n+z', (n: number) => `1${' '.repeat(n)}z`],
    ['maker: a>+空白n (矢印の右が空白だけ)', (n: number) => `a>${' '.repeat(n)}`],
  ] as Array<[string, (n: number) => string]>) {
    const text = `部品名\t型式\t数量\nリレー\t${mk(n)}\t1\n端子台\tXW2B\t2\n`
    const t0 = performance.now()
    const r = parseBomPaste(text)
    const ms = Math.round(performance.now() - t0)
    out.push({ n, name, ms, rows: r.rows.length })
    console.log(JSON.stringify({ n, name, ms, rows: r.rows.length }))
    if (ms > 20000) break
  }
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r20/178-redos-arrow' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
