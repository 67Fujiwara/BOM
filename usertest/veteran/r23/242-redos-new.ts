// ラウンド22: ラウンド21 で変わった正規表現・ループ（delClass の注記・為/に付き・一部/半分・DNP の備考・kindIsDel・wordMark・closesProperly/outside・consistency）を
// 長い繰り返し（NN 文字、既定 20000）× 置く場所（備考/新型式/変更区分/DNP/部品名/数量/見出し/引用符つきの行）で CPU 時間を測る。300ms 超を出す。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const n = Number(process.env.NN ?? 20000)
const S = ' ', Z = '　'
const R = (s: string, k = n) => s.repeat(Math.max(1, Math.floor(k / Math.max(1, s.length))))
const PATS: Array<[string, string]> = [
  ['削除+（×n', '削除' + R('（')], ['削除（+）×n', '削除（' + R('）')], ['削除（+あ×n', '削除（' + R('あ')], ['削除（+（×n+）', '削除（' + R('（') + '）'], ['削除→+空白×n+x', '削除→' + R(S) + 'x'], ['削除+空白×n+（x）', '削除' + R(S) + '（保留）'], ['削除（+空白×n+）', '削除（' + R(S) + '）'], ['削除（+全角空白×n+）', '削除（' + R(Z) + '）'],
  ['Rev.+1×n', 'Rev.' + R('1') + '削除'], ['Rev.+空白×n+削除', 'Rev.' + R(S) + '削除'], ['Rev2+空白×n', 'Rev.2' + R(S) + '削除'], ['不要×n+削除', R('不要') + '削除'], ['全×n+削除', R('全') + '削除'], ['一部×n+削除', R('一部') + '削除'], ['削除×n+（一部', R('削除') + '（一部'], ['ため×n', R('ため') + '削除'], ['削除+予定×n', '削除' + R('予定')], ['（+一部×n', '削除（' + R('一部')],
  ['→×n+削除', R('→') + '削除'], ['空白×n+削除', R(S) + '削除'], ['全角空白×n+削除', R(Z) + '削除'], ['※×n+削除', R('※') + '削除'], ['要×n+削除', R('要') + '削除'], ['今回×n+削除', R('今回') + '削除'], ['（×n+削除', R('（') + '削除'], ['*×n+削除', R('*') + '削除'], ['x+削除', R('x') + '削除'],
  ['削除+）×n+x', '削除' + R('）') + 'x'], ['削除+。×n', '削除' + R('。')], ['削除+!×n', '削除' + R('!')], ['削除+済×n', '削除' + R('済')], ['削除+して×n', '削除' + R('して')], ['削除しない×n', R('削除しない')], ['x+削除×n', 'x' + R('削除')],
  ['DNP+空白×n+x', 'DNP' + R(S) + 'x'], ['DNP+/×n', 'DNP' + R('/')], ['DNP+品×n', 'DNP' + R('品')], ['DNP+（×n', 'DNP' + R('（')], ['DNP+全角空白×n', 'DNP' + R(Z) + 'x'], ['未実装+（×n', '未実装' + R('（')], ['実装しない+空白×n', '実装しない' + R(S)], ['実装しない+空白×n+（', '実装しない' + R(S) + '（x）'], ['Not Fitted+空白×n', 'Not Fitted' + R(S) + 'x'],
  ['×+×n', R('×')], ['x+空白×n', 'x' + R(S)], ['d+空白', 'D' + R(S)], ['del+.×n', 'del' + R('.')], ['削+空白×n', '削' + R(S) + 'x'], ['取外し+空白×n', '取外し' + R(S) + 'x'],
  ['"×n', R('"')], ['",×n', R('",')], ['"x×n', R('"x')], ['""×n', R('""')], [',"×n', R(',"')], ['tab×n', R('\t')], [',×n', R(',')], ['a,b×n', R('a,b ')],
  ['1→×n', R('1→')], ['A→B×n', R('A→B ')], ['A->×n', R('A->')], ['数→数', '1' + R('0') + '→2'],
  ['同左×n', R('同左')], ['変更なし×n', R('変更なし')], ['No change×n', R('no change ')],
  ['部品表+空白×n+1/2', '部品表' + R(S) + '1/2'], ['部品表 (1/', '部品表 (' + R('1') + '/2)'], ['page×n', 'page ' + R('1')],
]
// 置く場所
const T = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')
const SHAPES: Array<[string, (c: string) => string]> = [
  ['note-sparse', (c) => T([['部品名', '旧型式', '新型式', '数量', '備考'], ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', ''], ['対象', 'ZZ-1', '', '3', c], ['基準D', 'Q-1', '', '5', '']])],
  ['model-sparse', (c) => T([['部品名', '旧型式', '新型式', '数量', '備考'], ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', ''], ['対象', 'ZZ-1', c, '3', ''], ['基準D', 'Q-1', '', '5', '']])],
  ['two-notes', (c) => T([['部品名', '旧型式', '新型式', '数量', '備考', '変更内容'], ['基準A', 'MY2N', 'MY4N', '1', '', '型式変更'], ['対象', 'ZZ-1', '', '3', c, c], ['基準D', 'Q-1', '', '5', '', '']])],
  ['kind-col', (c) => T([['変更区分', '部品名', '型式', '数量'], ['追加', 'A', 'M-1', '1'], [c, 'B', 'M-2', '2'], ['削除', 'C', 'M-3', '3']])],
  ['kind-col-taiou', (c) => T([['対応', '部品名', '型式', '数量'], ['追加', 'A', 'M-1', '1'], [c, 'B', 'M-2', '2'], [c, 'C', 'M-3', '3']])],
  ['dnp-col', (c) => T([['部品名', '型式', '数量', 'DNP'], ['A', 'M-1', '1', c], ['B', 'M-2', '2', '']])],
  ['ordinary-note', (c) => T([['部品名', '型式', 'メーカ', '数量', '備考'], ['A', 'M-1', 'オムロン', '1', c], ['B', 'M-2', 'オムロン', '2', '']])],
  ['ordinary-name', (c) => T([['部品名', '型式', 'メーカ', '数量', '備考'], [c, 'M-1', 'オムロン', '1', ''], ['B', c, c, '2', c]])],
  ['qty', (c) => T([['部品名', '型式', '数量'], ['A', 'M-1', c], ['B', 'M-2', '2']])],
  ['header', (c) => T([['部品名', c, '数量'], ['A', 'M-1', '1']])],
  ['csv-quoted', (c) => ['部品名,型式,メーカ,数量,備考', `A,M-1,オムロン,1,${c}`, `B,M-2,${c},2,`, 'C,M-3,x,3,'].join('\n')],
  ['csv-ml', (c) => ['部品名,型式,メーカ,数量,備考', `A,M-1,オムロン,1,"a, b\n${c.replace(/"/g, '""')}"`, 'B,M-2,x,2,'].join('\n')],
  ['tsv-comma', (c) => ['部品名\t型式\t員数\t回路記号', `A\tM-1\t1\t${c}, R2, R3, R4, R5`, 'B\tM-2\t2\tR1, R2, R3, R4, R5'].join('\n')],
  ['tsv-title', (c) => [`${c}`, '部品名\t型式\t数量', 'A\tM-1\t1'].join('\n')],
]
const out: any[] = []
let total = 0
const SKIPQ = !!process.env.SKIPQ
for (const [sname, mk] of SHAPES) for (const [pname, cell] of PATS) {
  if (SKIPQ && /^("|",|"x|""|,"|tab|,×|a,b)/.test(pname)) continue
  const text = mk(cell); total++
  const c0 = process.cpuUsage()
  try { parseBomPaste(text) } catch { /* 例外は別 */ }
  const c1 = process.cpuUsage(c0)
  const ms = Math.round((c1.user + c1.system) / 1000)
  if (ms > 300) { out.push({ sname, pname, len: text.length, ms }); console.log(JSON.stringify({ sname, pname, len: text.length, ms })) }
}
console.log('done runs=', total, 'slow=', out.length, 'n=', n)
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/242-redos-new-${n}${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
