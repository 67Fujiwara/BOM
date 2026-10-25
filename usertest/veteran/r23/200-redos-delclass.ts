// CPU 時間（ms。負荷の影響を受けない）で測る。削除の言い方の括弧の中（inner.replace(/[）)】\]]+$/)）が長い閉じ括弧の繰り返し＋最後に別の文字で二乗になるか。n を倍々で。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const mk = (c: string, where: 'model' | 'note') => ['部品名\t旧型式\t新型式\t数量\t備考', where === 'model' ? `A\tM-1\t${c}\t1\t` : `A\tM-1\t\t1\t${c}`, 'B\tM-2\tM-3\t2\t', 'C\tM-4\tN-4\t2\t'].join('\n')
const out: any[] = []
for (const [name, f] of [['削除（+)×n+x', (n: number) => '削除（' + ')'.repeat(n) + 'x'], ['削除→+）×n+x', (n: number) => '削除→' + '）'.repeat(n) + 'x'], ['撤去（x+]×n+y', (n: number) => '撤去（x' + ']'.repeat(n) + 'y'], ['x+削除', (n: number) => 'x' + '　'.repeat(n) + '削除'], ['削除+空白×n+x', (n: number) => '削除' + ' '.repeat(n) + 'x']] as const) {
  for (const where of ['model', 'note'] as const) {
    const row: any = { name, where, ms: {} }
    for (const n of [5000, 10000, 20000, 40000, 80000]) {
      const text = mk(f(n), where); const c0 = process.cpuUsage(); parseBomPaste(text); const c1 = process.cpuUsage(c0); row.ms[n] = Math.round((c1.user + c1.system) / 1000)
      if (row.ms[n] > 8000) break
    }
    out.push(row); console.log(JSON.stringify(row))
  }
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/200-redos-delclass${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
