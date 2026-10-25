// 199 で 300ms を超えた組み合わせを CPU 時間（ms）で測り直す（共有マシンの負荷に左右されない）。n を倍々にして二乗かを見る。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const R = (s: string, k: number) => s.repeat(k)
const SP = ' ', FW = '　'
const change = (c: string, col: string) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: '', 数量: '1', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t備考', Object.values(r).join('\t'), 'B\tM-2\t\t2\t', 'C\tM-3\tM-3\t2\t', 'D\tM-4\tN-4\t2\t', 'E\tM-5\tM-5\t2\t', 'F\tM-6\tM-6\t2\t'].join('\n') }
const copy = (c: string, col: string) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: 'M-1', 数量: '1', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t備考', Object.values(r).join('\t'), 'B\tM-2\tM-2\t2\t', 'C\tM-3\tM-3\t2\t', 'D\tM-4\tN-4\t2\t', 'E\tM-5\t\t2\t', 'F\tM-6\t\t2\t'].join('\n') }
const hensyu = (c: string, col: string) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: '', 数量: '1', 変更内容: '', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t変更内容\t備考', Object.values(r).join('\t'), 'B\tM-2\tM-2\t2\t\t', 'C\tM-3\tM-3\t2\t\t', 'D\tM-4\tN-4\t2\t\t', 'E\tM-5\t\t2\t\t'].join('\n') }
const plain = (c: string, col: string) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', メーカ: 'オムロン', 数量: '1', 備考: '', 単位: '個', 回路記号: 'R1' }; r[col] = c; return ['部品名\t型式\tメーカ\t数量\t備考\t単位\t回路記号', Object.values(r).join('\t'), 'B\tM-2\tオムロン\t2\t\t個\tR2'].join('\n') }
const noHeader = (c: string) => [`A\t${c}\t1`, 'B\tM-2\t2'].join('\n')
const CASES: Array<[string, (n: number) => string, (c: string) => string]> = [
  ['削除（+)×n+x / change 備考', (n) => '削除（' + R(')', n) + 'x', (c) => change(c, '備考')],
  ['削除（+)×n+x / change 変更後型式', (n) => '削除（' + R(')', n) + 'x', (c) => change(c, '変更後型式')],
  ['削除（+)×n+x / hensyu 変更内容', (n) => '削除（' + R(')', n) + 'x', (c) => hensyu(c, '変更内容')],
  ['削除（+)×n+x / plain 備考(普通のBOM)', (n) => '削除（' + R(')', n) + 'x', (c) => plain(c, '備考')],
  ['撤去（x+]×n+y / copy 備考', (n) => '撤去（x' + R(']', n) + 'y', (c) => copy(c, '備考')],
  ['0×n+x / change 数量', (n) => R('0', n) + 'x', (c) => change(c, '数量')],
  ['0×n+x / noHeader', (n) => R('0', n) + 'x', noHeader],
  ['0×n+x / plain 数量', (n) => R('0', n) + 'x', (c) => plain(c, '数量')],
  ['1+ ×n / plain 数量', (n) => R('1+', n / 2) + 'x', (c) => plain(c, '数量')],
  ['x+全角空白×n+削除 / copy 型式', (n) => 'x' + R(FW, n) + '削除', (c) => copy(c, '型式')],
  ['削除+全角空白×n+x / plain 部品名', (n) => '削除' + R(FW, n) + 'x', (c) => plain(c, '部品名')],
  ['(×n+削除 / hensyu 備考', (n) => R('(', n) + '削除', (c) => hensyu(c, '備考')],
  ['削除+NBSP×n+x / copy 型式', (n) => '削除' + R(' ', n) + 'x', (c) => copy(c, '型式')],
]
const out: any[] = []
for (const [name, f, mk] of CASES) {
  const row: any = { name, cpuMs: {} }
  for (const n of [10000, 20000, 40000, 80000]) {
    const text = mk(f(n))
    const c0 = process.cpuUsage(); parseBomPaste(text); const c1 = process.cpuUsage(c0)
    row.cpuMs[n] = Math.round((c1.user + c1.system) / 1000)
    if (row.cpuMs[n] > 12000) break
  }
  out.push(row); console.log(JSON.stringify(row))
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/204-redos-cpu${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
