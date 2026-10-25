// ラウンド23: 狙い撃ちの小さな形。名前・入力(TSV の行の配列)・期待(部品名の並び)を書き、現行/r22 ビルドで取り込み結果を出す
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
type C = { id: string; text: string; expect?: string; note?: string }
const T = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')
const C_ = (rows: string[][]) => rows.map((r) => r.join(',')).join('\n')
const cases: C[] = []
const add = (id: string, text: string, expect?: string, note?: string) => cases.push({ id, text, expect, note })
const chg = (note: string, extra: string[] = []) => T([['部品名', '旧型式', '新型式', '数量', '備考'], ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', '型式変更'], ['基準C', 'P-1', 'P-2', '3', ''], ['対象', 'ZZ-100', '', '4', note], ['基準D', 'Q-1', '', '5', ''], ...extra.map((e, i) => ['X' + i, 'Y' + i, '', '1', e])])
// 流用元の「から」: 他から取外して使う（この行は残る）
for (const [i, n] of ['他盤から撤去', '既設盤から取外し', '旧機から取外し', '前機種から撤去', '流用元から取外し', 'A号機から取外し', '倉庫から取外し', '客先から撤去', '在庫から取り外し'].entries()) add('FROM' + i, chg(n), '基準A,基準B,基準C,対象,基準D', 'から＋撤去＝流用元（残すべき）')
// 「を/は/も」: 他の部品の削除を書いた備考（この行は残る）
for (const [i, n] of ['ケーブルを削除', 'カバーを撤去', '配線は削除', 'SW2も撤去', 'ラベルを取外し'].entries()) add('WO' + i, chg(n), '基準A,基準B,基準C,基準D', 'この行自身の削除（新が空）なので削除でよい')
// 部品名・型式に削除の語尾が来る普通の BOM
for (const [i, n] of ['撤去', '取外し', '廃止', '削除', 'ケーブル取外し', 'カバー撤去', '安全装置を撤去', 'ユニットを廃止', '電線を取外し'].entries()) add('NAME' + i, T([['部品名', '型式', '数量'], [n, 'M-1', '1'], ['B', 'M-2', '1']]), n + ',B', '普通の BOM の部品名')
// 区分の列で「削除」の語尾を持つ普通の値
for (const [i, n] of ['ケーブルを削除', '全て削除', '不要につき削除', '一式不要', '全削除', 'この部品は削除'].entries()) add('KINDV' + i, T([['変更区分', '部品名', '型式', '数量'], ['追加', 'A', 'M-1', '1'], [n, 'DEL', 'M-2', '1'], ['変更', 'C', 'M-3', '1']]), 'A,C', '変更区分に文章')
// DNP の備考
for (const [i, n] of ['DNP(大日本印刷)製', 'DNP（凸版比較）', 'DNP 手配', 'DNP品', 'DNP/凸版 比較', 'DNP:RF-100', 'DNP 反射フィルム', 'dnp将来用', 'DNP 将来用', 'DNP/未実装', 'DNP:オプション', 'DNP-100', 'DNP【反射】', '(DNP)', '※DNP', 'DNP。', 'DNP.', 'DNP不要', 'DNPなし', 'DNP no', 'DNPの', 'DNP-RF', 'DNP[1]', 'DNPオプション品', 'DNP 対応', 'DNP未', 'DNP(未実装)'].entries())
  add('DNP' + i, T([['部品名', '型式', '数量', '備考'], ['A', 'M-1', '1', n], ['B', 'M-2', '1', '']]), n.includes('将来') || n.includes('未') || n.includes('オプション') || n.includes('不要') || n.includes('なし') || n === '(DNP)' || n === '※DNP' || n === 'DNP。' || n === 'DNP.' ? 'B' : 'A,B', 'DNP 備考')
// trimMarks 周り
for (const [i, n] of ['（未実装）', '※未実装', '*未実装', '【未実装】', '[未実装]', '((未実装))', '※※未実装', '　未実装　', '（Not Fitted）', '*DNP*', '＊DNP', '(DNP', 'DNP)', '※(DNP)'].entries())
  add('TRIM' + i, T([['部品名', '型式', '数量', '備考'], ['A', 'M-1', '1', n], ['B', 'M-2', '1', '']]), 'B', 'trimMarks')
// 名前に実装しない語
for (const [i, n] of ['未実装基板', '未実装品の検査', 'Not Fitted Label', 'DNP Label', 'dnp'].entries()) add('DNPN' + i, T([['部品名', '型式', '数量'], [n, 'M-1', '1'], ['B', 'M-2', '1']]), n === 'dnp' ? 'B' : n + ',B', '部品名')
const out: any[] = []
for (const c of cases) {
  const r = parseBomPaste(c.text)
  const names = r.rows.map((x: any) => x.name || x.model).join(',')
  const ok = c.expect === undefined || names === c.expect
  out.push({ id: c.id, ok, names, expect: c.expect, delim: r.delimiter, w: r.warnings.map((w) => w.slice(0, 60)), note: c.note, text: c.text.slice(0, 200) })
  console.log(`${ok ? 'ok ' : 'NG '} ${c.id.padEnd(8)} got=${names} exp=${c.expect ?? '-'}  ${c.text.split('\n').pop()?.replace(/\t/g, '|').slice(0, 50)}  ${r.warnings.map((w) => w.slice(0, 40)).join(' / ')}`)
}
console.log('NG', out.filter((o) => !o.ok).length, '/', out.length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/304-targeted' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 1))
