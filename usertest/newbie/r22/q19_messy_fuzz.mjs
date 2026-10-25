// ラウンド22 q19: 散らかったふつうの BOM（表題・署名・ページ見出し・合計・〃・複数行セル・半角カナ・DNP 列・CSV/TSV 両方）の乱数。旧（r21 測定ビルド）と今で行が変わるものを数える
import fs from 'node:fs'
import { loadParsers, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '56e5aba')
const N = Number(process.argv[2] || 3000)
let seed = Number(process.argv[3] || 31)
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const names = ['電磁リレー', 'タイマ', '端子台', 'ヒューズ', 'ケーブル', 'コネクタ', 'ダイオード', 'LED', 'スイッチ', 'ボルト', 'ﾘﾚｰ', 'ﾀｲﾏ', '抵抗\n(角形)', 'コンデンサ\n10uF, 25V']
const models = ['MY4N-D2 DC24V', 'H3CR-A8 AC100-240', 'XW2B-20G4', 'F-5A', '1N4007 (>100V)', 'GRM188R71H104KA93D', 'LM358DR', 'B4B-XH-A', '2SC1815-Y', 'SPW-5-10', 'S8VK-G24024', 'KIV 1.25sq 黒', 'ＭＴ－２．５', 'φ6×100L', '3/4"', '10k±1%']
const makers = ['オムロン', '三菱電機', 'ミスミ', 'IDEC', '〃', 'ｵﾑﾛﾝ', '']
const notes = ['', '', '盤内上段', '予備', '要確認', '納期注意, 代替可', '削除', '削除不要', '取外し可能', '撤去スペース確保', 'DNP', 'Not Fitted', '未実装', 'Rev.B', '1行目\n2行目', '〃']
const hdrSets = [['品名', '型式', 'メーカー', '数量', '備考'], ['No', '品名', '型式', 'メーカー', '数量', '単位', '備考'], ['Reference', 'Value', 'Footprint', 'Qty', 'MPN', 'DNP'], ['記号', '品名', '型式', 'メーカー', '員数', '備考'], ['ﾋﾝﾒｲ', 'ｶﾀｼｷ', 'ﾒｰｶｰ', 'ｽｳﾘｮｳ'], ['品名', '型式', 'メーカー', '1号機', '2号機', '合計'], ['部品名', '型式', '数量', '備考']]
let diffs = 0, total = 0
const samples = []
const cnt = new Map()
for (let it = 0; it < N; it++) {
  const hdr = pick(hdrSets)
  const nrow = 3 + Math.floor(rnd() * 8)
  const rows = []
  const title = rnd() < 0.4 ? [['○○盤 部品表 (1/2)'], ['作成', '山田', '承認', '鈴木']] : []
  rows.push(...title.map((t) => [...t, ...Array(Math.max(0, hdr.length - t.length)).fill('')]))
  rows.push(hdr)
  for (let i = 0; i < nrow; i++) {
    rows.push(hdr.map((h, j) => {
      if (/^(No|記号|Reference)$/.test(h)) return h === 'Reference' ? pick(['C1, C2, C3', 'R1', 'U1', 'D1, D2']) : String(i + 1)
      if (/品名|名$|^Value|ﾋﾝﾒｲ/.test(h)) return pick(names)
      if (/型式|形式|MPN|ｶﾀｼｷ/.test(h)) return pick(models)
      if (/Footprint/.test(h)) return pick(['C_0603', 'SOIC-8'])
      if (/メーカ|ﾒｰｶｰ/.test(h)) return pick(makers)
      if (/数量|員数|Qty|ｽｳﾘｮｳ|号機|合計/.test(h)) return String(1 + Math.floor(rnd() * 9))
      if (h === '単位') return pick(['個', '本', 'm'])
      if (h === 'DNP') return pick(['', '', '', 'DNP', 'x'])
      if (/備考/.test(h)) return pick(notes)
      return ''
    }))
  }
  if (rnd() < 0.3) rows.push(['合計', ...Array(hdr.length - 1).fill('')])
  const csv = rnd() < 0.5
  const q = (c, d) => (/["\n]/.test(c) || c.includes(d) ? '"' + c.replace(/"/g, '""') + '"' : c)
  const text = rows.map((r) => r.map((c) => q(c, csv ? ',' : '\t')).join(csv ? ',' : '\t')).join('\r\n')
  total++
  let a, b
  try { a = old.parseBomPaste(text); b = neu.parseBomPaste(text) } catch { continue }
  const sa = JSON.stringify(a.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note, r.unit])), sb = JSON.stringify(b.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note, r.unit]))
  if (sa !== sb) {
    diffs++
    const key = hdr.join('/') + (csv ? ' [csv]' : ' [tsv]')
    cnt.set(key, (cnt.get(key) ?? 0) + 1)
    if (samples.length < 6) samples.push({ text: text.slice(0, 700), old: a.rows.map(lab).join(' '), neu: b.rows.map(lab).join(' '), warn: b.warnings.join(' / ').slice(0, 200) })
  }
}
const out = { total, diffs, cnt: [...cnt], samples }
fs.writeFileSync('results/q19_messy_fuzz.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify({ total, diffs, cnt: [...cnt] }))
