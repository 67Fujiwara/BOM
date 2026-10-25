// ラウンド23: 2,500 行の変更表（変えた行だけ書く）で、備考の p% に「削除の話ではない」ふつうの注記（据付手順・図面・流用元・全数検査など 60 通り）を入れたとき、
// 変えていない行がいくつ黙って削除されるか／【削除？】が付くか／残るか
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const ORD = ['保護フィルムを取外し', '保護カバーを取り外し', '輸送用金具を取外し', '輸送固定ボルトは取外し', '出荷時にラベルを撤去', '仮止めネジを取外し', '養生テープを撤去', 'ダストカバーを取外してください', '据付後に支持金具を撤去', '試運転後にジャンパ線を撤去', 'テストピンも撤去', '旧図面を廃止', '旧規格は廃止', '旧品番を廃止', '古い仕様書を削除', '不要なコメントを削除', '仮設配線を撤去', '仮設ケーブルは撤去', '工事用足場を撤去', '他盤から撤去', '既設盤から取外し', '旧機から撤去', '在庫から取外し',
  '盤内', '要予備', '新規', '位置変更', '全数検査', '全数確認', '全て新品', '全品交換', '2台目から追加', 'Rev.Bから変更', '次ロットから変更', '客先支給', 'UL認定品', '納期注意', '代替可', '図面参照', '取外し時注意', '撤去用ブラケット', '削除は次回', '削除履歴あり', '削除ボタン', '取外し可能', '撤去スペース確保', '廃止品番に注意', '取外し箇所は図面参照', '撤去履歴あり', '取外し治具']
const out: any[] = []
for (const p of [0.01, 0.05, 0.1, 0.3]) {
  const rows = ['部品名\t旧型式\t新型式\t数量\t備考']
  let tot = 0
  for (let i = 1; i <= 2500; i++) {
    const r = ((i * 2654435761) % 1000) / 1000
    const changed = i % 10 === 0
    const note = r < p ? ORD[i % ORD.length] : ''
    if (r < p && !changed) tot++
    rows.push(`部品${i}\tOLD-${i}\t${changed ? 'NEW-' + i : ''}\t1\t${note}`)
  }
  const res = parseBomPaste(rows.join('\n'))
  const flagged = (res.rows as any[]).filter((x) => String(x.note ?? '').startsWith('【削除？】')).length
  const lost = 2500 - res.rows.length
  out.push({ p, noted: tot, rows: res.rows.length, lost, flagged })
  console.log(`p=${p}: 注記つき(変えていない)=${tot} 行数=${res.rows.length}/2500 黙って削除=${lost} 【削除？】=${flagged}`)
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/316-fp-ordinary' + (process.env.TAG ?? '') + '.json', JSON.stringify(out))
