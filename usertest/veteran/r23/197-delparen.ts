// 削除の言い方：括弧・矢印の注記の中に、削除の語に近い語（予定・対象・変更・Rev・盤・R番号・除く・済）が否定や例外の形で入るもの。
// 期待 keep（残す）なのに deleted（黙って消える）になるものを探す。note 列と新型式の列。
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
// 否定そのもの（削除しない）: 残すのが正しい
const KEEP = ['削除（予定なし）', '削除（予定は無い）', '撤去（予定なし）', '廃止（予定なし）', '取外し（予定なし）', '削除（対象外）', '削除（対象ではない）', '撤去（対象外）', '削除（変更なし）', '削除（変更無し）', '削除（変更しない）', '削除（変更不要）', '削除（済ではない）', '削除（未済）', '削除（完了していない）', '削除（未完了）', '削除（残す）', '削除（このまま）', '削除（現状維持）', '削除（継続使用）', '削除→予定なし', '削除→対象外', '削除→変更なし', '削除→残す', '削除→済ではない', '廃止→継続', '廃止→継続使用', '廃止→流用', '削除→再利用', '撤去（流用）', '撤去（流用品）', '撤去（他盤へ流用）']
// 一部だけ削除・条件つき: 黙って決めず【削除？】で聞くのが正しい
const PARTIAL = ['削除（盤は除く）', '削除（盤は残す）', '削除（盤は対象外）', '削除（ユニットは残す）', '削除（ユニット単位ではない）', '削除（Rev.2では残す）', '削除（Rev.2まで残す）', '削除（R012は残す）', '削除（R012は対象外）', '撤去（盤は継続使用）', '撤去→盤は残す', '削除→Rev.3まで残す', '削除→R012は残す']
const DEL = ['削除（予定）', '削除（Rev.2）', '削除（R012）', '削除（盤ごと）', '削除（ユニット単位）', '削除（対象）', '削除（済）', '削除（完了）', '削除→済', '削除→完了', '削除→Rev.2', '削除（変更により）', '撤去（Rev.1）', '廃止（R012へ統合）', '取外し（盤ごと）']
const hdr = ['部品名', '旧型式', '新型式', '数量', '備考']
function probe(phrase: string, where: 'note' | 'model') {
  const rows: string[][] = [hdr, ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', '型式変更'], where === 'note' ? ['対象', 'ZZ-100', '', '4', phrase] : ['対象', 'ZZ-100', phrase, '4', ''], ['基準D', 'Q-1', '', '5', '']]
  const res = parseBomPaste(rows.map((r) => r.join('\t')).join('\n'))
  const t = res.rows.find((r: any) => r.name === '対象')
  return !t ? 'deleted' : String(t.note ?? '').includes('【削除？】') ? 'flag' : 'kept'
}
const out: any = {}
for (const [name, list, want] of [['KEEP', KEEP, 'kept'], ['PARTIAL', PARTIAL, 'flag'], ['DEL', DEL, 'deleted']] as const) for (const where of ['note', 'model'] as const) {
  const r: Record<string, string[]> = { deleted: [], flag: [], kept: [] }
  for (const p of list) r[probe(p, where)].push(p)
  out[`${name}/${where}`] = r
  console.log(`${name}/${where} n=${list.length} deleted=${r.deleted.length} flag=${r.flag.length} kept=${r.kept.length}`)
  if (name === 'KEEP' && r.deleted.length) console.log('   FP deleted:', r.deleted.join(' ｜ '))
  if (name === 'KEEP' && r.flag.length) console.log('   flag:', r.flag.join(' ｜ '))
  if (name === 'PARTIAL') { if (r.deleted.length) console.log('   deleted silently:', r.deleted.join(' ｜ ')); if (r.kept.length) console.log('   kept silently:', r.kept.join(' ｜ ')) }
  if (name === 'DEL' && r.kept.length) console.log('   FN kept:', r.kept.join(' ｜ '))
  if (name === 'DEL' && r.flag.length) console.log('   flag:', r.flag.join(' ｜ '))
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/197-delparen${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 1))
