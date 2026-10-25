// ラウンド22 q11: ふつうの BOM（変更図の列なし）の乱数。旧（r21 の測定ビルド）と今で取り込み結果が変わるものを数える
// 使い方: node q11_ordinary_fuzz.mjs [件数] [seed] [OLD=rev]
import fs from 'node:fs'
import { loadParsers, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '56e5aba')
const N = Number(process.argv[2] || 3000)
let seed = Number(process.argv[3] || 22)
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const names = ['電磁リレー', 'タイマ', '端子台', 'ヒューズ', 'ケーブル', 'コネクタ', 'ダイオード', 'コンデンサ', '抵抗', 'LED', 'スイッチ', '圧着端子', 'ボルト', 'スペーサ', 'カバー', '変換アダプタ', 'ブレーカ', 'センサ']
const models0 = ['MY4N-D2 DC24V', 'H3CR-A8 AC100-240', 'XW2B-20G4', 'F-5A', 'DVI→HDMI', 'USB-A→USB-C', 'DB9->RJ45', 'RS232C->USB', '1N4007 (>100V)', 'PT1/4>φ6', 'M4x10 (SUS304)', 'UL1007 AWG22 (赤→黒)', 'CAT5e→CAT6', '24VDC→12VDC', 'AC100V>DC24V', 'GRM188R71H104KA93D', 'LM358DR', 'B4B-XH-A', '2SC1815-Y', 'SPW-5-10', 'NF32-SV 3P 30A', 'S8VK-G24024', 'TK-100', 'A22NN-BPM-NGA-G100-NN', 'KIV 1.25sq 黒', 'ＭＴ－２．５', 'φ6×100L', '3/4"', '10k±1%', 'DC24V→AC100V 変換']
const models = process.env.NOARROW ? models0.filter((m) => !/→|->/.test(m)) : models0
const makers = ['オムロン', '三菱電機', 'ミスミ', 'IDEC', '住電', 'TI', 'ON', 'エレコム', 'フエニックス', '', 'サンワ', 'DNP']
const notes = ['', '', '', '盤内上段', '予備', '取付位置は図面参照', '位置決めピン付', '交換用', '交換部品', '消耗品（定期交換）', '追加購入品', '銘板付', '設計変更対応済', '長さ変更可', 'Rev.B', '削除不要', '取外し可能な構造', '撤去スペース確保', '前回の削除分を復活', '客先支給', '要確認', '納期注意', 'DNP', '削除', '不要', '廃止予定', '削除済', '色: 赤→黒', '→ 右側に配線', '削除（保留）', '取外し（再取付）', '撤去工事は別途', '削除予定', 'USB-C へ変更', '変更なし', 'そのまま', 'No change', '同上', '〃', '-', '－']
const hdrSets = [['品名', '型式', 'メーカー', '数量'], ['部品名', '形式', 'メーカ', '員数', '備考'], ['No', '品名', '型式', 'メーカー', '数量', '単位', '備考'], ['Item', 'Part No', 'Manufacturer', 'Qty', 'Remarks'], ['品名', '型式', '数量', '備考'], ['品名', '型式', 'メーカー', '数量', '備考', '納期', '単価'], ['記号', '品名', '型式', 'メーカー', '数量', '備考'], ['品名', '型式', 'メーカー', '数量', '区分', '備考'], ['品名', '型式', 'メーカー', '数量', '対応', '備考'], ['品名', '型式', 'メーカー', '数量', '種別'], ['品名', '型式', 'メーカー', '数量', '変更', '備考'], ['品名', '型式', 'メーカー', '数量', '状態', '備考'], ['品名', '型式', '現行品番', 'メーカー', '数量'], ['品名', '型式', 'メーカー', '数量', '旧型式', '備考'], ['品名', '型式', 'メーカー', '数量', 'Action'], ['品名', '型式', 'メーカー', '数量', '処置', '備考']]
const vals = { 区分: ['購入品', '加工品', '社内', 'A', 'B', 'D', '', '-'], 対応: ['済', '未', '対応', '○', '×', '不要', ''], 種別: ['電気', '機械', '消耗品', 'x', 'D', ''], 変更: ['', '', '○', '済', '追加', '変更'], 状態: ['新品', '使用中', '廃止', '予定', ''], Action: ['', '購入', 'Order', 'Stock', 'x'], 処置: ['', '購入', '在庫', '不要'], 旧型式: ['', 'MY2N', 'H3CR-A7'], 現行品番: ['MY4N', 'H3CR', 'XW2B'] }
let diffs = 0, total = 0
const causes = new Map()
const samples = new Map()
for (let it = 0; it < N; it++) {
  const hdr = pick(hdrSets)
  const nrow = 3 + Math.floor(rnd() * 6)
  const lines = []
  if (rnd() < 0.3) lines.push(['○○盤 部品表', ...Array(hdr.length - 1).fill('')].join('\t'))
  lines.push(hdr.join('\t'))
  for (let i = 0; i < nrow; i++) {
    const r = hdr.map((h) => {
      if (/^(No|記号)$/.test(h)) return String(i + 1)
      if (/品名|名$|Item|^部品名/.test(h)) return pick(names)
      if (/型式|形式|Part|現行品番/.test(h) && !/旧/.test(h)) return pick(models)
      if (/メーカ|Manufacturer/.test(h)) return pick(makers)
      if (/数量|員数|Qty/.test(h)) return String(1 + Math.floor(rnd() * 9))
      if (h === '単位') return pick(['個', '本', 'm'])
      if (/備考|Remarks/.test(h)) return pick(notes)
      if (h === '納期') return pick(['', '2週', '即納'])
      if (h === '単価') return pick(['1,200', '300', ''])
      if (vals[h]) return pick(vals[h])
      return ''
    })
    lines.push(r.join('\t'))
  }
  if (rnd() < 0.2) lines.push(['合計', ...Array(hdr.length - 1).fill('')].join('\t'))
  const text = lines.join('\n')
  total++
  let a, b
  try { a = old.parseBomPaste(text); b = neu.parseBomPaste(text) } catch (e) { continue }
  const sa = JSON.stringify(a.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note, r.unit])), sb = JSON.stringify(b.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note, r.unit]))
  if (sa !== sb) {
    diffs++
    // 原因の分類
    const w = b.warnings.join(' / ')
    const fewer = b.rows.length < a.rows.length; const key = (fewer ? '【行が減った】' : '') + (/が削除の \d+ 行/.test(w) ? 'kind列で削除' : /旧→新/.test(w) ? '矢印' : /実装しない/.test(w) ? 'DNP' : /削除の印がある/.test(w) ? '新旧の削除' : /見出し/.test(w) ? '見出し' : 'その他')
    const kk = key + ' | hdr=' + hdr.join('/')
    causes.set(key, (causes.get(key) ?? 0) + 1)
    if (!samples.has(kk) && samples.size < 40) samples.set(kk, `${w.slice(0, 160)}\n   old: ${a.rows.map(lab).join(' ')}\n   new: ${b.rows.map(lab).join(' ')}`)
  }
}
const out = [`total ${total}, diffs ${diffs}`, JSON.stringify([...causes]), ...[...samples].map(([k, v]) => `## ${k}\n   ${v}`)]
fs.writeFileSync(`results/n09_ordinary_fewer${process.env.OLD ? '_' + process.env.OLD : ''}.out`, out.join('\n') + '\n')
console.log(out.slice(0, 2).join('\n'))
