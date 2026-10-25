// ラウンド23 n13: 変更区分らしい列があるのに読まなかったとき、知らせが出るか（U22-01 の再確認）
import { loadParsers, T } from './parselib.mjs'
const { neu } = await loadParsers('68e45f7')
const cases = [
  ['ステータス 削除/保留/確認中/OK（あいまい見出し・語彙少）', 'ステータス', ['削除', '保留', '確認中', 'OK']],
  ['Status Delete/Hold/Open/Done', 'Status', ['Delete', 'Hold', 'Open', 'Done']],
  ['対応 削除/済/未/対応中', '対応', ['削除', '済', '未', '対応中']],
  ['変更区分 削除（保留）/据え置き/型式変更/Add', '変更区分', ['削除（保留）', '据え置き', '型式変更', 'Add']],
  ['変更区分 保留/確認中/未定/OK（削除なし）', '変更区分', ['保留', '確認中', '未定', 'OK']],
  ['更新区分 Cancel/Hold/Keep/Add', '更新区分', ['Cancel', 'Hold', 'Keep', 'Add']],
  ['Action 削除してください/残す/残す/残す', 'Action', ['削除してください', '残す', '残す', '残す']],
  ['区分 削除/削除/削除/削除（全部削除）', '区分', ['削除', '削除', '削除', '削除']],
]
for (const [t, h, vs] of cases) {
  const tx = T(`品名｜型式｜メーカー｜数量｜${h}\n${vs.map((v, i) => `部品${i}｜P-${i}0｜メーカ｜1｜${v}`).join('\n')}`)
  const r = neu.parseBomPaste(tx)
  console.log(`${t}: ${r.rows.length}行 mapping=${r.mapping.map((m) => m ?? '-').join(',')} warnings=${r.warnings.map((w) => w.slice(0, 50)).join(' / ') || '(なし)'}`)
}
