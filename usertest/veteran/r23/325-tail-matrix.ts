// ラウンド23: 備考の言い方を 名詞 × 助詞 × 動詞 × 前置き × 後置き の乱数 20,000 通りで作り、変えた行だけ書く表の備考に入れて deleted/flag/kept を数える（助詞・後置き別）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import { rng } from './h22.ts'
const { pick, int } = rng(Number(process.env.SEED ?? 25))
const NOUN = ['ケーブル', 'ラベル', 'カバー', '保護フィルム', '図面', '仕様書', 'ジャンパ線', '端子台', 'リレー', 'タイマ', 'ユニット', '盤', '配線', 'ダクト', '治具', 'ネジ', 'ボルト', '金具', 'ブラケット', '旧品番', 'R5', 'SW1', '2台目', '3号機', 'Rev.B', '全て', 'すべて', '全部', '全数', '本部品', 'この部品', '']
const PART = ['を', 'は', 'も', 'から', '', 'の', 'が', 'で', 'に', 'まで', 'だけ', 'ごと']
const VERB = ['削除', '撤去', '廃止', '取外し', '取り外し', '取外し済', '削除済', '削除する', '撤去します', '削除しない', '撤去せず', '取外し不要', '削除予定', '撤去可']
const PRE = ['', '', '出荷時に', '据付後に', '現地で', '次回', 'Rev.Bで', '旧', '仮設', '不要のため', '客先要望により']
const POST = ['', '', '', '。', '（要確認）', 'のこと', 'してください', '(保留)', '後に再取付', '時注意', '用']
const key = (r: any) => { const t = r.rows.find((x: any) => x.name === '対象'); return !t ? 'deleted' : String(t.note ?? '').startsWith('【削除？】') ? 'flag' : 'kept' }
const out: any[] = []
const N = Number(process.env.N ?? 20000)
for (let i = 0; i < N; i++) {
  const phrase = pick(PRE) + pick(NOUN) + pick(PART) + pick(VERB) + pick(POST)
  const rows = [['部品名', '旧型式', '新型式', '数量', '備考'], ['基準A', 'MY2N', 'MY4N', '1', '型式変更'], ['基準B', 'XA-1', 'XA-2', '2', '型式変更'], ['基準C', 'P-1', 'P-2', '3', ''], ['対象', 'ZZ-100', '', '4', phrase], ['基準D', 'Q-1', '', '5', '']]
  out.push({ phrase, k: key(parseBomPaste(rows.map((r) => r.join('\t')).join('\n'))) })
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r23/dl/325-tail-matrix${process.env.TAG ?? ''}.json`, JSON.stringify(out))
const c: Record<string, number> = {}; for (const o of out) c[o.k] = (c[o.k] ?? 0) + 1
console.log(JSON.stringify(c))
