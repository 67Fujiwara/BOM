// ラウンド22: 削除の言い方の3分類（keep/del/ask）を 150 超の言い方で。変えた行だけ書く表（旧型式｜新型式｜備考）の備考に 1 つずつ入れる。
// D=削除と読むべき（外れる）／K=残すべき（黙って消したら FP＝部品が消える）／A=聞く（【削除？】）か、どちらにしても黙って決めない。
// 結果: deleted / flag / kept。D→kept=FN、K→deleted=FP（重大）、K→flag=ノイズ、A→deleted/kept=黙って決めた。
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const D = ['削除', '削除済', '削除します', '削除のこと', '不要のため削除', '不要の為削除', '不要に付き削除', '不要につき削除', '全削除', '一式削除', '全撤去', '全廃止', '一式撤去', '盤ごと削除', 'ユニットごと削除', '本変更で削除', 'Rev.2で削除', 'R012に置換のため削除', '統合のため撤去', '削除（R012に置換）', '削除（不要品）', '削除（生産中止）', '削除（客先要望）', '削除（廃番）', '削除（確認済）', '削除（検討済）', '削除（仕様変更のため）', '削除（Rev.3）', '削除（他案件へ流用）', '削除→R012へ', '撤去済', '取外し済', '廃止', '廃止済', '廃止品につき削除', '不要', 'Delete', 'Deleted', 'Removed', 'DEL', '削除してください', '削除願います', '削除をお願いします', '削除確定', '削除決定', '削除対象', '設計変更により削除', '客先要望で削除', '仕様変更で廃止', '使用しない', 'この部品は削除', '削除！', '※削除', '【削除】', '(削除)', '削除。', '削除 ', '本数削除', '削除（2台目から）', '2台目から削除', '全て削除', '全部削除', '全て撤去', '一式不要', '全数削除', 'すべて削除']
const K = ['削除不要', '削除は不要', '削除しない', '削除せず', '削除保留', '削除見送り', '削除予定なし', '削除予定はありません', '削除（予定なし）', '削除（対象外）', '削除（変更なし）', '削除（保留）', '削除（要確認）', '削除（しない）', '削除（取消）', '削除（検討中）', '削除→保留', '削除→復活', '削除はしない', '削除は行わない', '削除してはいけない', '削除不可', '削除NG', '撤去不可', '取外し不可', '取外し可能', '撤去スペース確保', '取外し時注意', '取外し工具使用', '撤去後に再取付', '廃止品番に注意', '廃止部品の代替あり', '削除履歴あり', '削除ログ', '削除スイッチ付き', '取外し式', '取外しハンドル付き', '撤去用ブラケット', '削除ボタン', '削除（予定は無い）', '削除（変更しない）', '削除（継続使用）', '削除（盤は残す）', '削除（Rev.2では残す）', '削除（R012は残す）', '全削除しない', '全削除不要', '一式削除は不要', '全削除は見送り', '全撤去しない', '不要の為削除しない', '不要に付き削除しない', '不要の為削除は保留', '一式撤去は不要', '削除（対象ではない）', '削除（済ではない）', '削除（未済）', '削除（完了していない）', '削除（未完了）', '撤去（流用）', '撤去（他盤へ流用）', '廃止→継続使用', '廃止→流用', '削除（変更不要）', '削除（盤は除く）', '削除しなくてよい', '削除を取り消し', '削除を取りやめ', '削除の件は撤回', '廃止の予定なし', '全削除予定なし', '全撤去は保留']
const A = ['削除予定', '削除に変更', '削除？', 'Del?', '削除検討', '廃止予定', '撤去予定', '削除かも', '削除or変更', '削除したい', '削除の可否', '削除（要否検討）', '一部削除', '半分撤去', '削除（一部）', '削除（Rev.2のみ）', '削除（盤のみ）', '削除（2個中1個）', '削除を検討', '削除（検討）', '一部のみ削除', '削除（予備のみ）', '削除（1台分）', '削除（一部流用）', '全削除？', '一式削除か', '一部不要', '削除（半分）']
const hdr = ['部品名', '旧型式', '新型式', '数量', '備考']
function probe(phrase: string, where: 'note' | 'model') {
  const rows: string[][] = [hdr, ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', '型式変更'], ['基準C', 'P-1', 'P-2', '3', '']]
  rows.push(where === 'note' ? ['対象', 'ZZ-100', '', '4', phrase] : ['対象', 'ZZ-100', phrase, '4', ''])
  rows.push(['基準D', 'Q-1', '', '5', ''])
  const res = parseBomPaste(rows.map((r) => r.join('\t')).join('\n'))
  const t = res.rows.find((r: any) => r.name === '対象')
  if (!t) return 'deleted'
  if (String(t.note ?? '').includes('【削除？】') || String(t.model ?? '').includes('【削除？】')) return 'flag'
  return 'kept'
}
const res: any = { D: { note: {}, model: {} }, K: { note: {}, model: {} }, A: { note: {}, model: {} } }
const lines: string[] = []
for (const [cls, list] of [['D', D], ['K', K], ['A', A]] as const) for (const where of ['note', 'model'] as const) {
  const b: Record<string, string[]> = { deleted: [], flag: [], kept: [] }
  for (const p of list) b[probe(p, where)].push(p)
  res[cls][where] = b
  lines.push(`${cls}/${where} n=${list.length} deleted=${b.deleted.length} flag=${b.flag.length} kept=${b.kept.length}`)
}
console.log(lines.join('\n'))
for (const [cls, w] of [['D', 'kept'], ['D', 'flag'], ['K', 'deleted'], ['K', 'flag'], ['A', 'deleted'], ['A', 'kept']] as const) for (const where of ['note', 'model'] as const) {
  const l = res[cls][where][w]
  if (l.length) console.log(`  ${cls}/${where} -> ${w} (${l.length}): ${l.join(' ｜ ')}`)
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/232-delclass-phrases${process.env.TAG ?? ''}.json`, JSON.stringify({ lines, res }, null, 1))
