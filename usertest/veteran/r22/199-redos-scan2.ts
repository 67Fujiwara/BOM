// 取り込みの正規表現の時間（ReDoS）第 2 弾。r20 の 180 に、削除の言い方（括弧・矢印・Rev）・変更内容・DNP・〃・全角/NBSP の空白・閉じ括弧の繰り返しを足す。
// CPU 時間で測る。EXCLUDE（正規表現）で既知の二乗のパターンを除く。n = 20000（NN で変更）。300ms 超を出し、遅いものは 2n でも測って二乗かどうかを見る。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const n = Number(process.env.NN ?? 20000)
const SP = ' ', FW = '　', NB = ' ', ZW = '​', TAB = ' '
const R = (s: string, k = n) => s.repeat(k)
const pats = (n: number): Array<[string, string]> => [
  ['削除（+）×n+x', '削除（' + R(')', n) + 'x'], ['削除（+】×n+x', '削除（' + R('】', n) + 'x'], ['削除（+x+)×n', '削除（x' + R(')', n)], ['削除→+）×n+x', '削除→' + R('）', n) + 'x'],
  ['削除（×n', '削除' + R('（', n)], ['削除[×n', '削除' + R('[', n)], ['(×n+削除', R('(', n) + '削除'], ['※×n+削除', R('※', n) + '削除'], ['[×n+削除', R('[', n) + '削除'],
  ['削除+全角空白×n+x', '削除' + R(FW, n) + 'x'], ['削除+NBSP×n+x', '削除' + R(NB, n) + 'x'], ['削除+ZWSP×n+x', '削除' + R(ZW, n) + 'x'], ['全角空白×n+削除', R(FW, n) + '削除'],
  ['x+全角空白×n+削除', 'x' + R(FW, n) + '削除'], ['削除×n/2 空白区切り', R('削除 ', n / 2)], ['削除×n/2 +x', R('削除', n / 2) + 'x'], ['削除済×n/3', R('削除済', n / 3)],
  ['Rev.+空白×n', 'Rev.' + R(SP, n) + 'x'], ['Rev.1 +空白×n+削除', 'Rev.1' + R(SP, n) + '削除'], ['(Rev.×n', R('(Rev.', n / 5)], ['rev1rev1…', R('rev1', n / 4) + '削除'], ['Rev.+数字×n', 'Rev.' + R('1', n)],
  ['変更+空白×n+なし', '変更' + R(SP, n) + 'x'], ['変更×n/2', R('変更', n / 2) + 'x'], ['変更 ×n/2', R('変更 ', n / 2) + 'x'], ['変更は×n/3', R('変更は', n / 3) + 'x'], ['追加なし×n/4', R('追加なし', n / 4)], ['位置 空白×n 位置', R('位置' + SP, n / 3) + 'x'],
  ['x→×n', 'a' + R('→', n) + 'b'], ['a→ +空白×n+b', 'a→' + R(SP, n) + 'b'], ['a +空白×n+→b', 'a' + R(SP, n) + '→b'], ['a->×n/2', R('a->', n / 3) + 'b'], ['a-×n->b', 'a' + R('-', n) + '>b'], ['a.×n→b', R('A.', n / 2) + '→b'], ['a/×n→b', R('a/', n / 2) + '→b'], ['a +×n→', R('a+', n / 2) + '→'],
  ['DNP+(×n', 'DNP' + R('(', n)], ['DNP+空白×n+(', 'DNP' + R(SP, n) + '('], ['未実装+空白×n+(x', '未実装' + R(FW, n) + '(x'], ['not fitted+空白', 'not' + R(SP, n) + 'fitted'], ['do not+空白', 'do' + R(SP, n) + 'not place'],
  ['〃×n', R('〃', n)], ['"×n', R('"', n)], ['空白×n+〃', R(SP, n) + '〃'], ['〃+空白×n+x', '〃' + R(SP, n) + 'x'], ['ditto×n', R('ditto', n / 5)], ['。×n+x', R('。', n) + 'x'], ['.×n+x', R('.', n) + 'x'], ['空白.空白.×n', R(' .', n / 2) + 'x'],
  ['0×n+x', R('0', n) + 'x'], ['0.0.0', R('0.', n / 2) + 'x'], ['1+1+…', R('1+', n / 2) + 'x'], ['1+空白+1', R('1 + ', n / 3) + 'x'], ['数字+空白×n+台', '3' + R(SP, n) + '台'], ['数字+空白×n+x', '3' + R(SP, n) + 'x'], ['数字空白台×n', R('3 台 ', n / 4)],
  ['x+tab-space×n', 'x' + R(TAB, n) + 'y'], ['区分×n', R('区分', n / 2)], ['(x)×n/3', R('(x)', n / 3)], ['（予備）×n', R('（予備', n / 3)], ['(予備1)+…', '1' + R('(予備1)', n / 5)],
]
const SHAPES: Array<[string, string[], (c: string, col: string) => string]> = [
  ['plain', ['部品名', '型式', 'メーカ', '数量', '備考', '単位', '回路記号'], (c, col) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', メーカ: 'オムロン', 数量: '1', 備考: '', 単位: '個', 回路記号: 'R1' }; r[col] = c; return ['部品名\t型式\tメーカ\t数量\t備考\t単位\t回路記号', Object.values(r).join('\t'), 'B\tM-2\tオムロン\t2\t\t個\tR2'].join('\n') }],
  ['changeNote', ['部品名', '型式', '変更後型式', '数量', '備考'], (c, col) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: '', 数量: '1', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t備考', Object.values(r).join('\t'), 'B\tM-2\t\t2\t', 'C\tM-3\tM-3\t2\t', 'D\tM-4\tN-4\t2\t', 'E\tM-5\tM-5\t2\t', 'F\tM-6\tM-6\t2\t'].join('\n') }],
  ['copyNote', ['部品名', '型式', '変更後型式', '数量', '備考'], (c, col) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: 'M-1', 数量: '1', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t備考', Object.values(r).join('\t'), 'B\tM-2\tM-2\t2\t', 'C\tM-3\tM-3\t2\t', 'D\tM-4\tN-4\t2\t', 'E\tM-5\t\t2\t', 'F\tM-6\t\t2\t'].join('\n') }],
  ['hensyu', ['部品名', '型式', '変更後型式', '数量', '変更内容', '備考'], (c, col) => { const r: Record<string, string> = { 部品名: 'A', 型式: 'M-1', 変更後型式: '', 数量: '1', 変更内容: '', 備考: '' }; r[col] = c; return ['部品名\t型式\t変更後型式\t数量\t変更内容\t備考', Object.values(r).join('\t'), 'B\tM-2\tM-2\t2\t\t', 'C\tM-3\tM-3\t2\t\t', 'D\tM-4\tN-4\t2\t\t', 'E\tM-5\t\t2\t\t'].join('\n') }],
  ['kind', ['変更区分', '部品名', '型式', '数量'], (c, col) => { const r: Record<string, string> = { 変更区分: '追加', 部品名: 'A', 型式: 'M-1', 数量: '1' }; r[col] = c; return ['変更区分\t部品名\t型式\t数量', Object.values(r).join('\t'), '削除\tB\tM-2\t2', '〃\tC\tM-3\t2'].join('\n') }],
  ['kind区分', ['区分', '部品名', '型式', '数量'], (c, col) => { const r: Record<string, string> = { 区分: '追加', 部品名: 'A', 型式: 'M-1', 数量: '1' }; r[col] = c; return ['区分\t部品名\t型式\t数量', Object.values(r).join('\t'), '削除\tB\tM-2\t2', '変更\tC\tM-3\t2'].join('\n') }],
  ['machines', ['旧1号機', '新1号機', '旧2号機', '新2号機'], (c, col) => { const r: Record<string, string> = { 旧1号機: '6', 新1号機: '7', 旧2号機: '6', 新2号機: '' }; r[col] = c; return ['部品名\t型式\t旧1号機\t新1号機\t旧2号機\t新2号機', `A\tM-1\t${r.旧1号機}\t${r.新1号機}\t${r.旧2号機}\t${r.新2号機}`, 'B\tM-2\t1\t\t1\t'].join('\n') }],
  ['title', ['-'], (c) => [`製作台数\t${c}`, '', '部品名\t型式\t1台当り数量', 'A\tM-1\t2'].join('\n')],
  ['titleLabel', ['-'], (c) => [`${c}`, '', '部品名\t型式\t員数', 'A\tM-1\t2'].join('\n')],
  ['headerCell', ['-'], (c) => [`部品名\t${c}\t数量`, 'A\tM-1\t2', 'B\tM-2\t2'].join('\n')],
  ['headerKana', ['-'], (c) => [`部品名\t型式\t数量\t${c}`, 'A\tM-1\t2\t1'].join('\n')],
  ['csvq', ['-'], (c) => ['部品名,型式,数量,備考', `A,"${c}",1,`, 'B,M-2,2,'].join('\n')],
  ['csvRaw', ['-'], (c) => ['部品名,型式,数量,備考', `A,${c.replace(/[,\n]/g, ' ')},1,`, 'B,M-2,2,'].join('\n')],
  ['tsvQ', ['-'], (c) => ['部品名\t型式\t数量\t備考', `A\t"${c.replace(/"/g, '""')}"\t1\t`, 'B\tM-2\t2\t'].join('\n')],
  ['oneCol', ['-'], (c) => ['部品名', c, 'x'].join('\n')],
  ['noHeader', ['-'], (c) => [`A\t${c}\t1`, 'B\tM-2\t2'].join('\n')],
]
const out: unknown[] = []
let nShapes = 0
const EXC = process.env.EXCLUDE ? new RegExp(process.env.EXCLUDE) : null
for (const [sname, cols, mk] of SHAPES) for (const col of cols) for (const [pname, cell] of pats(n)) {
  if (EXC && EXC.test(pname)) continue
  nShapes++
  const text = mk(cell, col)
  const c0 = process.cpuUsage()
  try { parseBomPaste(text) } catch { /* 例外は別 */ }
  const c1 = process.cpuUsage(c0)
  const ms = Math.round((c1.user + c1.system) / 1000)
  if (ms > 300) {
    // 二乗か: 2n で
    const cell2 = pats(n * 2).find(([p]) => p === pname)![1]
    const d0 = process.cpuUsage()
    try { parseBomPaste(mk(cell2, col)) } catch { /* */ }
    const d1 = process.cpuUsage(d0)
    const ms2 = Math.round((d1.user + d1.system) / 1000)
    out.push({ sname, col, pname, ms, ms2x: ms2 }); console.log(JSON.stringify({ sname, col, pname, ms, ms2x: ms2 }))
  }
}
console.log('done combos=', nShapes, 'slow=', out.length)
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/199-redos-scan2${process.env.TAG ?? ''}-${n}.json`, JSON.stringify(out, null, 1))
