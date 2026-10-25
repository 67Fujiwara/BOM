// 削除の言い方の 3 分類（del / keep / ask）の当たり外れ。変えた行だけ書く表（旧型式｜新型式｜備考）の備考と、新型式の列に言い方を 1 つずつ入れて取り込む。
// 結果: deleted（行が外れる）／flag（【削除？】）／kept。期待と比べて FN（del なのに残る）・FP（keep なのに消える）・silent（ask なのに黙って決める）を数える。
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const DEL = ['削除', '削除済', '削除済み', '削除します', '削除する', '削除してください', '削除願います', '削除をお願いします', '削除お願いします', '削除のこと', '削除です', '削除となります', '削除とする', '削除確定', '削除決定', '削除対象', '削除（不要）', '削除（R012に置換）', '削除 (Rev.2)', '削除→不要', '削除→R012', '削除。', '削除!!', '削除　', '※削除', '【削除】', '要削除', '今回削除', '本変更で削除', 'Rev.2で削除', 'Rev.B:削除', '(Rev.2)削除', '不要につき削除', '不要のため削除', '不要の為削除', '不要に付き削除', '設計変更により削除', '統合のため削除', '統合のため撤去', 'R012へ統合 削除', 'ユニットごと削除', '盤ごと削除', '旧品削除', '全削除', '一式削除', '廃止', '廃止します', '廃止済', '廃止のこと', '廃止品', '撤去', '撤去済', '撤去済み', '撤去します', '撤去のこと', '取外し', '取り外し', '取外し済', '取り外し済み', '取外してください', '取り外して下さい', '不要', '不使用', '使用しない', '使わない', '欠番', '中止', '取止め', '取りやめ', 'DEL', 'Del', 'Delete', 'Deleted', 'Removed', 'REMOVE', 'Rev.1 削除', '削除Rev.2', '削除　（Rev.2）', '削除(旧品)', '削除（盤ごと）', '削除→廃止', '撤去（Rev.2）', '廃止（R012に置換）', '取外し（Rev.3）']
const KEEP = ['削除不要', '削除は不要', '削除せず', '削除しない', '削除しないこと', '削除しません', '削除保留', '削除見送り', '削除検討', '削除検討中', '削除撤回', '削除取消', '削除取り消し', '削除は次回', '削除予定なし', '削除禁止', '削除NG', '削除不可', '削除できない', '削除→復活', '削除→保留', '削除→要確認', '削除→再検討', '削除（保留）', '削除（要確認）', '削除（しない）', '削除(Rev.3で復活)', '削除（取消）', '削除（未定）', '削除（検討中）', '廃止延期', '廃止予定なし', '廃止取りやめ', '廃止見送り', '撤去不可', '撤去しない', '撤去（再取付）', '撤去後に再取付', '撤去（予定なし）', '取外し時注意', '取外し工具を使用', '取外し不要', '取外し可能', '取外しは次回', '撤去用ブラケット', '撤去品を流用', '撤去品の再利用', '廃止品番に注意', '廃止品の代替', '削除用治具', '削除の可否を確認', '削除してはいけない', '削除すると故障', '削除した場合は連絡', '廃止になったら代替へ', '取外し・再取付', '取外し箇所は図面参照', '撤去時は2名で作業', '撤去スペース確保', '撤去対象外', '削除対象外', '削除は不要です', '削除不要です', '削除不要。', '削除なし', '削除無し', '撤去なし', '取外しなし', '廃止なし', '削除ではない', '削除ではなく変更', '削除せず流用', '削除せずに残す', '削除は行わない', '削除はしない', '削除しなくてよい', '削除しなくて良い', '取り外し不要', '取り外しなし', '取り外し時注意', '撤去工具', '廃止品注意', '撤去履歴あり', '削除履歴あり', '撤去機構', '取外し治具']
const ASK = ['削除に変更', '削除で', '削除方向', '削除予定', '削除候補', '削除かも', '削除？', '削除?', 'Del?', '要削除？', '廃止予定', '撤去予定', '取外し予定', '削除or変更', '削除/変更', '削除したい', '削除したほうがよい', '削除案', '廃止案', '削除相談', '削除を検討', '削除の予定', '削除か変更', '削除または変更', '撤去か移設', '削除（要否未定）', '削除（Rev.未定）', '削除（検討）', '削除→変更', '削除してもよい', '削除で良いか', '削除を依頼', '削除依頼', '削除指示', '削除申請', '削除提案', '廃止検討', '撤去検討', '取外し検討', '削除検討要', '廃止の方向', '廃止か否か']
const hdr = ['部品名', '旧型式', '新型式', '数量', '備考']
function probe(phrase: string, where: 'note' | 'model') {
  const rows: string[][] = [hdr, ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', '型式変更'], ['基準C', 'P-1', 'P-2', '3', '']]
  const target = where === 'note' ? ['対象', 'ZZ-100', '', '4', phrase] : ['対象', 'ZZ-100', phrase, '4', '']
  rows.push(target)
  rows.push(['基準D', 'Q-1', '', '5', ''])
  const res = parseBomPaste(rows.map((r) => r.join('\t')).join('\n'))
  const t = res.rows.find((r: any) => r.name === '対象')
  if (!t) return 'deleted'
  if (String(t.note ?? '').includes('【削除？】')) return 'flag'
  return 'kept'
}
const out: any = { build: SRC }
const table: Record<string, Record<string, string[]>> = {}
for (const [cls, list] of [['DEL', DEL], ['KEEP', KEEP], ['ASK', ASK]] as const) {
  for (const where of ['note', 'model'] as const) {
    const res: Record<string, string[]> = { deleted: [], flag: [], kept: [] }
    for (const p of list) res[probe(p, where)].push(p)
    ;(table[cls + '/' + where] ??= {}) as any
    table[cls + '/' + where] = res
  }
}
const sum: string[] = []
for (const [k, r] of Object.entries(table)) sum.push(`${k} n=${r.deleted.length + r.flag.length + r.kept.length} deleted=${r.deleted.length} flag=${r.flag.length} kept=${r.kept.length}`)
console.log(sum.join('\n'))
for (const [k, r] of Object.entries(table)) {
  const [cls] = k.split('/')
  const bad = cls === 'DEL' ? ['kept', 'flag'] : cls === 'KEEP' ? ['deleted', 'flag'] : ['deleted', 'kept']
  for (const b of bad) if (r[b].length) console.log(`  ${k} -> ${b} (${r[b].length}): ${r[b].join(' ｜ ')}`)
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r22/196-delclass${process.env.TAG ?? ''}.json`, JSON.stringify({ sum, table }, null, 1))
