// ラウンド23 tail FP（新しい言い方 187）: 削除の言い方の3分類（keep/del/ask）を 150 超の言い方で。変えた行だけ書く表（旧型式｜新型式｜備考）の備考に 1 つずつ入れる。
// D=削除と読むべき（外れる）／K=残すべき（黙って消したら FP＝部品が消える）／A=聞く（【削除？】）か、どちらにしても黙って決めない。
// 結果: deleted / flag / kept。D→kept=FN、K→deleted=FP（重大）、K→flag=ノイズ、A→deleted/kept=黙って決めた。
import fs from 'node:fs'
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
const D = []
const K = ["保護フィルムを取外し", "保護カバーを取り外し", "輸送用金具を取外し", "輸送固定ボルトは取外し", "出荷時にラベルを撤去", "仮止めネジを取外し", "養生テープを撤去", "ダストカバーを取外してください", "据付後に支持金具を撤去", "試運転後にジャンパ線を撤去", "テストピンも撤去", "旧図面を廃止", "旧規格は廃止", "旧品番を廃止", "旧型番は廃止", "旧ロットは廃止", "旧ラベルを廃止", "古い仕様書を削除", "不要なコメントを削除", "重複データを削除", "誤記を削除", "仮設配線を撤去", "仮設ケーブルは撤去", "工事用足場を撤去", "他盤から撤去", "既設盤から取外し", "旧機から撤去", "在庫から取外し", "流用元から取り外し", "撤去品を再利用", "取外し品を流用", "全て確認", "全部確認", "全数検査", "全数確認", "全数撤去確認", "全て再利用", "すべて新品", "全て新規", "全品交換", "全て交換", "全て追加", "2台目から追加", "3号機から新規", "Rev.Bから追加", "Rev.Bから変更", "次ロットから変更", "次回から変更", "来月から廃止予定", "来月から削除予定"]
const A = []
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
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/313-tail-fp${process.env.TAG ?? ''}.json`, JSON.stringify({ lines, res }, null, 1))
