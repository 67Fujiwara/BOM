// ラウンド21: CPU 時間で測る（共有マシンの負荷に左右されない）。ラウンド20: 取り込みの正規表現の時間の爆発（ReDoS）を、セルの種類 × 長い繰り返しの形 × 表の形で総当たり。n = 20000 で 300ms を超えたものを出す。現行と r19 ビルド
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const n = Number(process.env.NN ?? 20000)
const SP = ' ', IDSP = '　'
const PATS: Array<[string, string]> = [
  ['a+空白+b', 'a' + SP.repeat(n) + 'b'], ['空白+b', SP.repeat(n) + 'b'], ['b+空白', 'b' + SP.repeat(n)], ['a+全角空白+b', 'a' + IDSP.repeat(n) + 'b'],
  ['1+空白+x', '1' + SP.repeat(n) + 'x'], ['削除+空白+x', '削除' + SP.repeat(n) + 'x'], ['x+ピリオド+y', 'x' + '.'.repeat(n) + 'y'], ['x+閉じ括弧+y', 'x' + '）'.repeat(n) + 'y'],
  ['x+削除×n+y', 'x' + '削除'.repeat(n / 2) + 'y'], ['x+→×n+y', 'x' + '→'.repeat(n) + 'y'], ['x+>×n+y', 'x' + '>'.repeat(n) + 'y'], ['x+(×n', 'x' + '('.repeat(n)], ['x+カナ×n', 'ヒ'.repeat(n) + 'x'], ['rev+空白', 'Rev.' + SP.repeat(n) + 'x'], ['dnp+空白', 'DNP' + SP.repeat(n) + 'x'], ['数字×n+x', '1'.repeat(n) + 'x'], ['0×n+x', '0'.repeat(n) + 'x'], ['2+1 ×n', '2+'.repeat(n / 2) + 'x'],
]
const SHAPES: Array<[string, (c: string, col: string) => string]> = [
  // 普通の表: 部品名・型式・メーカ・数量・備考・単位・回路記号
  ['plain', (c, col) => { const r = { 部品名: 'A', 型式: 'M-1', メーカ: 'オムロン', 数量: '1', 備考: '', 単位: '個', 回路記号: 'R1' } as Record<string, string>; r[col] = c; return ['部品名\t型式\tメーカ\t数量\t備考\t単位\t回路記号', Object.values(r).join('\t'), 'B\tM-2\tオムロン\t2\t\t個\tR2'].join('\n') }],
  // 変更表（型式の旧／新・備考）
  ['change', (c, col) => { const r = { 部品名: 'A', 型式: 'M-1', 変更後型式: '', 数量: '1', 備考: '' } as Record<string, string>; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t備考', Object.values(r).join('\t'), 'B\tM-2\t\t2\t', 'C\tM-3\tM-3\t2\t', 'D\tM-4\tN-4\t2\t', 'E\tM-5\tM-5\t2\t', 'F\tM-6\tM-6\t2\t'].join('\n') }],
  // 変更区分つき
  ['kind', (c, col) => { const r = { 変更区分: '追加', 部品名: 'A', 型式: 'M-1', 数量: '1' } as Record<string, string>; r[col] = c; return ['変更区分\t部品名\t型式\t数量', Object.values(r).join('\t'), '削除\tB\tM-2\t2'].join('\n') }],
  // 表題欄（製作台数）
  ['title', (c) => [`製作台数\t${c}`, '', '部品名\t型式\t1台当り数量', 'A\tM-1\t2'].join('\n')],
  ['title2', (c) => [`${c}`, '', '部品名\t型式\t員数', 'A\tM-1\t2'].join('\n')],
  // 見出しのセル
  ['header', (c) => [`部品名\t${c}\t数量`, 'A\tM-1\t2', 'B\tM-2\t2'].join('\n')],
  ['csvq', (c, col) => ['部品名,型式,数量,備考', `A,"${c}",1,`, 'B,M-2,2,'].join('\n')],
]
const out: unknown[] = []
const COLS: Record<string, string[]> = { plain: ['部品名', '型式', 'メーカ', '数量', '備考', '単位', '回路記号'], change: ['部品名', '型式', '変更後型式', '数量', '備考'], kind: ['変更区分', '部品名', '型式', '数量'], title: ['-'], title2: ['-'], header: ['-'], csvq: ['-'] }
for (const [sname, mk] of SHAPES) for (const col of COLS[sname]) for (const [pname, cell] of PATS) {
  const text = mk(cell, col)
  const c0 = process.cpuUsage()
  try { parseBomPaste(text) } catch { /* 例外は別 */ }
  const c1 = process.cpuUsage(c0)
  const ms = Math.round((c1.user + c1.system) / 1000)
  if (ms > 300) { out.push({ sname, col, pname, ms }); console.log(JSON.stringify({ sname, col, pname, ms })) }
}
console.log('done slow=', out.length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/180-redos-scan' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
