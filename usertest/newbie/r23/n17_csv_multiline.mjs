// ラウンド23 n17: Excel の CSV の複数行セルに、各行ともコンマがある（住所・盤内位置・仕様の書き方）。旧 68e45f7・56e5aba と新
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const cases = {
  '1列目に 2 行ともコンマ': '品名,型式,メーカー,数量,備考\r\n"リレー\n24V, 2a接点",MY4N-D2,オムロン,4,\r\nタイマ,H3CR-A8,オムロン,1,\r\n"ランプ\n赤, 緑",PL-24,IDEC,2,\r\n',
  '備考に 2 行ともコンマ': '品名,型式,メーカー,数量,備考\r\nリレー,MY4N-D2,オムロン,4,"盤内, 上段\n左, 右"\r\nタイマ,H3CR-A8,オムロン,1,\r\n',
  '1列目と備考の両方に（2 行ともコンマ）': '品名,型式,メーカー,数量,備考\r\n"リレー\n24V, 2a接点",MY4N-D2,オムロン,4,"盤内, 上段\n左, 右"\r\nタイマ,H3CR-A8,オムロン,1,\r\n',
  '備考が 3 行（各行コンマ）': '品名,型式,メーカー,数量,備考\r\nリレー,MY4N-D2,オムロン,4,"a, b\nc, d\ne, f"\r\nタイマ,H3CR-A8,オムロン,1,\r\n',
  '品名 1 列目だけ 2 行ともコンマ・他は単純': '品名,型式,数量\r\n"リレー, 24V\n接点, 2a",MY4N-D2,4\r\nタイマ,H3CR-A8,1\r\n',
  '型式に 2 行ともコンマ': '品名,型式,数量\r\nリレー,"MY4N-D2, 24V\nH3CR-A8, 100V",4\r\nタイマ,H3CR-A8,1\r\n',
  'Excel の「"」エスケープ入り': '品名,型式,数量,備考\r\nリレー,MY4N-D2,4,"1/2"" 継手, SUS\n長さ, 10"\r\nタイマ,H3CR-A8,1,\r\n',
}
const out = []
for (const [k, t] of Object.entries(cases)) {
  const o = old.parseBomPaste(t), r = neu.parseBomPaste(t)
  const exp = (t.match(/\r\n(?!$)/g) ?? []).length
  out.push(`## ${k}\n   old: ${o.rows.length}行 ${o.rows.map(lab).join(' ')}\n   new: ${r.rows.length}行 ${r.rows.map(lab).join(' ')} 備考=${JSON.stringify(r.rows.map((x) => x.note))}`)
}
fs.writeFileSync('results/n17_csv_multiline.out', out.join('\n') + '\n')
console.log(out.join('\n'))
