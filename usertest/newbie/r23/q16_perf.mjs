// ラウンド22 q16: 大きな貼り付けの解析時間（旧／新）
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers()
const time = (f) => { const t = Date.now(); const r = f(); return [Date.now() - t, r] }
const mk = (n, cols = 'tab') => ['品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考', ...Array.from({ length: n }, (_, i) => `部品${i}\tP-${i}\t${i % 3 ? '' : 'Q-' + i}\tオムロン\t${1 + (i % 9)}\t${i % 17 === 0 ? '削除（保留）' : i % 13 === 0 ? 'この部品は削除' : ''}`)].join('\n')
for (const n of [500, 5000, 30000]) {
  const t = mk(n)
  const [a] = time(() => old.parseBomPaste(t)), [b, r] = time(() => neu.parseBomPaste(t))
  console.log(`変更図 ${n} 行: old ${a}ms new ${b}ms rows=${r.rows.length}`)
}
const mk2 = (n) => ['品名\t型式\tメーカー\t数量\t備考', ...Array.from({ length: n }, (_, i) => `部品${i}\tM-${i}\tオムロン\t${1 + (i % 9)}\t${i % 7 === 0 ? 'DNP 将来用' : '盤内'}`)].join('\n')
for (const n of [5000, 30000]) { const t = mk2(n); const [a] = time(() => old.parseBomPaste(t)), [b, r] = time(() => neu.parseBomPaste(t)); console.log(`ふつう ${n} 行: old ${a}ms new ${b}ms rows=${r.rows.length}`) }
// 長いセル
for (const [name, cell] of [['閉じ括弧 8万', '削除' + '）'.repeat(80000)], ['開き括弧 8万', '削除' + '（'.repeat(80000)], ['削除 の繰り返し 4万', '削除'.repeat(40000)], ['空白 8万', '削除' + ' '.repeat(80000) + '済'], ['「→」8万', '削除' + '→'.repeat(80000)], ['括弧の中が長い 8万', '削除（' + '保留'.repeat(40000) + '）'], ['部品表 4万', '部品表'.repeat(13000)], ['数字 8万', '1'.repeat(80000)], ['DNP の繰り返し', 'DNP' + ' '.repeat(80000)], ['全角空白 8万の備考', '　'.repeat(80000) + '削除'], ['改行入り引用 長い', '"' + 'a\n'.repeat(40000) + '"']]) {
  const t = `品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考\nリレー\tMY2N\tMY4N-D2\tオムロン\t4\t\nタイマ\tH3CR\t\tオムロン\t1\t${cell}`
  const [b] = time(() => neu.parseBomPaste(t))
  const t2 = `品名\t型式\tメーカー\t数量\tDNP\n${cell}\tM\tオムロン\t1\t\nタイマ\tH3CR\tオムロン\t1\t`
  const [c] = time(() => neu.parseBomPaste(t2))
  console.log(`セル ${name}: 備考 ${b}ms / 品名 ${c}ms`)
}
