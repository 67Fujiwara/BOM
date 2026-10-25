// ラウンド23: ふつうの BOM（部品名・型式・メーカ・数量）に、ありそうな追加の列（区分/種別/ステータス/対応/変更/Action/備考…）を足して、現行と r22 ビルドで行数が変わらないか。
// 値は実在しそうな語彙（変更表ではない）。変わったものを（見出し × 値の組）で集計
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import { rng } from './h22.ts'
const { pick, chance, int } = rng(Number(process.env.SEED ?? 17))
const HEAD = ['区分', '種別', 'ステータス', 'Status', '対応', '変更', 'Action', 'Change', '処置', '改訂', '設変', '変更区分', '対応区分', '更新区分', '備考', '摘要', 'メモ', '調達区分', '手配', 'Rev', '納期', '担当', '状態', '採否', '要否', '有無', '判定', '確認', '備考2']
const VALS: string[][] = [
  ['購入', '自作', '流用', '新規'], ['新規', '継続', '廃止予定'], ['使用中', '廃止', '新規'], ['量産', '試作', 'EOL'], ['済', '未', '不要'], ['要', '不要'], ['有', '無'], ['○', '×'], ['○', '△', '×'], ['OK', 'NG'], ['A', 'B', 'C'], ['A', 'B', 'C', 'D'],
  ['追加', '変更', '流用'], ['新規', '変更', '削除'], ['対応済', '未対応', '不要'], ['対応中', '完了', '保留'], ['承認', '却下'], ['採用', '不採用'], ['標準', '特注'], ['在庫', '取寄せ', '支給'],
  ['', '', '要確認'], ['', '', '', '代替可'], ['盤内', '盤外'], ['2026-11-01', '2026-12-01'], ['山田', '鈴木'], ['Rev.A', 'Rev.B'], ['1', '2', '3'],
  ['保護フィルムを取外し', '', '', '新規'], ['旧図面を廃止', '', '客先支給'], ['全数検査', '', '納期注意'], ['他盤から流用', '', ''], ['取外し可能', '', ''],
]
const out: any[] = []
const agg: Record<string, number> = {}
const N = Number(process.env.N ?? 20000)
for (let t = 0; t < N; t++) {
  const nExtra = 1 + int(3)
  const hs: string[] = [], vs: string[][] = []
  for (let k = 0; k < nExtra; k++) { hs.push(pick(HEAD)); vs.push(pick(VALS)) }
  const nr = 3 + int(12)
  const hdr = ['部品名', '型式', 'メーカ', '数量', ...hs]
  const rows = [hdr]
  for (let r = 0; r < nr; r++) rows.push([`部品${r}`, `M-${r}`, 'オムロン', String(1 + (r % 5)), ...vs.map((v) => pick(v))])
  const sep = chance(0.5) ? '\t' : ','
  const res = parseBomPaste(rows.map((r) => r.join(sep)).join('\n'))
  out.push({ hs, vs: vs.map((v) => v.join('/')), n: res.rows.length, exp: nr, w: res.warnings.filter((w: string) => /削除|DNP|実装/.test(w)).length })
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/dl/317-ordinary-extra${process.env.TAG ?? ''}.json`, JSON.stringify(out))
console.log('cases', out.length, 'lost', out.filter((o) => o.n !== o.exp).length)
