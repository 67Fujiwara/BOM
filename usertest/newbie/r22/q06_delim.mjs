// ラウンド22 q06: 区切りの選び方（タブ区切りにコンマ入りの表題、コンマ区切りにタブ入りセル、EDA の回路記号のコンマ、千円区切り、〃の「"」の行）
import fs from 'node:fs'
import { loadParsers, lab } from './parselib.mjs'
const { old, neu } = await loadParsers()
const out = []
let mism = 0
const run = (title, text, exp) => {
  const o = old.parseBomPaste(text), r = neu.parseBomPaste(text)
  const a = r.rows.map(lab), b = o.rows.map(lab)
  const ok = exp ? (JSON.stringify(a) === JSON.stringify(exp) ? 'OK' : 'MISMATCH') : 'INFO'
  if (ok === 'MISMATCH') mism++
  out.push(`[${title}] ${ok}${JSON.stringify(a) !== JSON.stringify(b) ? ' (old≠new)' : ''} delim=${r.delimiter}\n   new: ${a.join(' ')} | map=${r.mapping.map((m) => m ?? '-').join(',')}${ok === 'MISMATCH' ? '\n   exp: ' + exp.join(' ') : ''}${JSON.stringify(a) !== JSON.stringify(b) ? '\n   old: ' + b.join(' ') : ''}\n   warn: ${r.warnings.join(' / ').slice(0, 260)}`)
}
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\n')
const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
const parts = [['リレー', 'MY4N-D2', 'オムロン', '4'], ['タイマ', 'H3CR-A8', 'オムロン', '1'], ['端子台', 'XW2B-20G4', 'オムロン', '4'], ['ヒューズ', 'F-5A', 'ミスミ', '10']]
const exp4 = ['MY4N-D2:4', 'H3CR-A8:1', 'XW2B-20G4:4', 'F-5A:10']
const H = ['品名', '型式', 'メーカー', '数量']
// 1 TSV + コンマ入りの表題行が n 行（上）
for (const n of [1, 3, 6, 9, 15]) {
  const titles = Array.from({ length: n }, (_, i) => [`注${i + 1}: 本表は, 盤用で, 変更時は, 連絡のこと`])
  run(`TSV 上にコンマ入りの表題 ${n} 行`, tsv([...titles, H, ...parts]), exp4)
  run(`TSV 下にコンマ入りの注記 ${n} 行`, tsv([H, ...parts, ...titles]), exp4)
}
// 2 TSV 備考列にコンマ入り（全行）
for (const k of [1, 3, 5, 8]) {
  const note = Array.from({ length: k + 1 }, (_, i) => `X${i}`).join(', ')
  run(`TSV 備考に全行 ${k} 個のコンマ`, tsv([[...H, '備考'], ...parts.map((p) => [...p, note])]), exp4)
}
// 3 TSV EDA 回路記号のコンマ（行ごとに数が違う）
run('TSV 回路記号 C1, C2, C3...', tsv([['回路記号', '品名', '型式', '数量'], ['C1, C2, C3, C4, C5, C6', 'コンデンサ', 'GRM188', '6'], ['R1, R2, R3', '抵抗', 'RK73', '3'], ['U1', 'IC', 'LM358', '1'], ['D1, D2', 'ダイオード', '1N4148', '2']]), ['GRM188:6', 'RK73:3', 'LM358:1', '1N4148:2'])
run('TSV 回路記号 全行 6 個以上', tsv([['回路記号', '品名', '型式', '数量'], ['C1, C2, C3, C4, C5, C6, C7', 'コンデンサ', 'GRM188', '7'], ['R1, R2, R3, R4, R5, R6, R7', '抵抗', 'RK73', '7'], ['L1, L2, L3, L4, L5, L6, L7', 'コイル', 'LQM21', '7']]), ['GRM188:7', 'RK73:7', 'LQM21:7'])
// 4 TSV 単価に千円区切り
run('TSV 単価 1,200 付き', tsv([[...H, '単価'], ['リレー', 'MY4N-D2', 'オムロン', '4', '1,200'], ['タイマ', 'H3CR-A8', 'オムロン', '1', '12,800'], ['端子台', 'XW2B-20G4', 'オムロン', '4', '3,500']]), ['MY4N-D2:4', 'H3CR-A8:1', 'XW2B-20G4:4'])
// 5 CSV + セルにタブ
run('CSV 備考セルにタブ（1 行）', csv([[...H, '備考'], ['リレー', 'MY4N-D2', 'オムロン', '4', 'a\tb'], ['タイマ', 'H3CR-A8', 'オムロン', '1', ''], ['端子台', 'XW2B-20G4', 'オムロン', '4', '']]), ['MY4N-D2:4', 'H3CR-A8:1', 'XW2B-20G4:4'])
run('CSV 全行の型式にタブ入り', csv([H, ['リレー', 'MY4N\t-D2', 'オムロン', '4'], ['タイマ', 'H3CR\t-A8', 'オムロン', '1'], ['端子台', 'XW2B\t-20G4', 'オムロン', '4']]))
run('CSV 表題にタブ（Excel 上部のセルが A1 にタブ入り）', csv([['○○盤\t部品表'], ['作成日\t2026-10-25'], H, ...parts]), exp4)
run('CSV 表題にタブが多数', csv([...Array.from({ length: 8 }, (_, i) => [`注${i}\tabc\tdef`]), H, ...parts]), exp4)
// 6 CSV 〃の " 行
run('CSV 〃の"（引用符なし）', ['品名,型式,メーカー,数量', 'リレー,MY4N-D2,オムロン,4', 'タイマ,H3CR-A8,",1', 'ランプ,L-1,",2'].join('\n').replace('",1', '",1'), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
run('CSV メーカーが " の行が続く', ['品名,型式,メーカー,数量', 'リレー,MY4N-D2,オムロン,4', 'タイマ,H3CR-A8,",1', 'ランプ,L-1,",2', 'ソケット,PYF14A,",2', '端子台,XW2B-20G4,IDEC,4'].join('\n'), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2', 'PYF14A:2', 'XW2B-20G4:4'])
run('CSV 品名が " の行', ['品名,型式,メーカー,数量', 'リレー,MY4N-D2,オムロン,4', '",H3CR-A8,オムロン,1', '",L-1,IDEC,2'].join('\n'), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
run('CSV 数量が " (最後の列)', ['品名,型式,メーカー,数量', 'リレー,MY4N-D2,オムロン,4', 'タイマ,H3CR-A8,オムロン,"', 'ランプ,L-1,IDEC,"'].join('\n'), ['MY4N-D2:4', 'H3CR-A8:4', 'L-1:4'])
run('CSV 型式にインチ 3/4" と〃', ['品名,型式,メーカー,数量', 'パイプ,PT 3/4",ミスミ,2', 'パイプ,"3/4"" エルボ",ミスミ,2', 'リレー,MY4N-D2,",4'].join('\n'))
run('TSV 〃の" 行', tsv([H, parts[0], ['タイマ', 'H3CR-A8', '"', '1'], ['ランプ', 'L-1', '"', '2']]), ['MY4N-D2:4', 'H3CR-A8:1', 'L-1:2'])
run('TSV 〃の" が列頭', ['品名\t型式\tメーカー\t数量', 'リレー\tMY4N-D2\tオムロン\t4', '"\tH3CR-A8\t"\t1', '"\tL-1\t"\t2'].join('\n'))
// 7 複数行セル（Excel の CSV）
run('CSV 複数行セル 品名', csv([H, ['リレー\n(小型)', 'MY4N-D2', 'オムロン', '4'], ['タイマ', 'H3CR-A8', 'オムロン', '1']]), ['MY4N-D2:4', 'H3CR-A8:1'])
run('CSV 複数行セル 備考にコンマ', csv([[...H, '備考'], ['リレー', 'MY4N-D2', 'オムロン', '4', '盤内上段, 左側\n要確認, 納期注意'], ['タイマ', 'H3CR-A8', 'オムロン', '1', '']]), ['MY4N-D2:4', 'H3CR-A8:1'])
run('TSV 複数行セル 備考にコンマ', tsv([[...H, '備考'], ['リレー', 'MY4N-D2', 'オムロン', '4', '"盤内上段, 左側\n要確認, 納期注意"'], ['タイマ', 'H3CR-A8', 'オムロン', '1', '']]), ['MY4N-D2:4', 'H3CR-A8:1'])
fs.writeFileSync('results/q06_delim.out', out.join('\n') + `\nMISMATCHES ${mism}\n`)
console.log(out.filter((x) => /MISMATCH/.test(x.split('\n')[0]) || /old≠new/.test(x.split('\n')[0])).join('\n'))
console.log('MISMATCHES', mism)
