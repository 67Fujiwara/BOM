// ラウンド23 n08: ふつうの BOM（旧／新・変更区分の列なし）を、実在らしい型式（記号入り）× 本物らしい備考（削除・撤去・取外し・廃止を文の中で使う）× 区分/ステータス/対応/Action の列で組み合わせ、旧 68e45f7 と新で同じに取り込めるか
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const models = ['M4×10 (SUS304)', 'φ6→φ4 ブッシング', '1N4007 (>100V)', 'PT1/4>φ6', 'DC24V→DC12V コンバータ', 'A→B 切替スイッチ', '10kΩ±1%', '100µF/25V', 'MY4N-D2 DC24V', 'H3CR-A8', 'XW2B-20G4', 'UL1007 AWG22 (赤)', 'CAT5e LANケーブル 5m', 'RS-232C→USB', 'DVI-D→HDMI', 'USB-A⇔USB-C', 'ST-3.5/4', 'M3x6 +', 'NBR70 φ10', 'TL431ACLP', 'SN74HC595N', '2SC1815-GR', '#4-40 UNC', 'R-10k(1/4W)', 'C-100u/16V', '3.3V→5V レベル変換', 'ABC-123 (旧: XYZ-9)', 'P&F NBB5-18GM50', 'IDEC AH22-M', 'CKD SCP*40-50']
const notes = ['', '盤内上段', '予備', '不要な場合は削除してください', '撤去後に再取付', '取外し可能', '廃止予定品のため代替検討中', '旧品番 ABC-1 から変更済', 'DNP製', 'メーカ: DNP', '削除不可', '削除しないこと', 'このユニットは削除禁止', '全て削除は不可', '来期から廃止予定', '客先確認後に削除', '図面から削除済', '位置変更あり', '銘板追加', '交換用', '交換部品', '長さ変更可', 'Rev.B', 'R12に置換', '代替品あり', '代替可', '置換用', 'ホスト→デバイス', 'A→B 配線', '型式変更なし', '設計変更対応済', '追加購入品', '消耗品（定期交換）', '撤去スペース確保', '取外し時注意', '撤去用ブラケット', '廃止品（在庫のみ）', '削除（未定）', '実装位置 A3', '実装方向注意']
const extra = [null, ['区分', ['購入品', '加工品', '流用', '新規', '購入品', '購入品']], ['ステータス', ['量産', '試作', '量産', '承認済', '量産', '量産']], ['対応', ['済', '未', '済', '済', '対応中', '済']], ['Action', ['Order', 'Hold', 'Order', 'Order', 'Buy', 'Order']], ['ステータス', ['新規', '継続', '継続', '継続', '新規', '継続']], ['区分', ['汎用', '専用', '流用', '汎用', '専用', '不要']], ['変更', ['', '', '○', '', '', '']]]
const sig = (res) => JSON.stringify({ r: res.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note, r.unit, r.ref, r.category]), w: res.warnings })
const out = []
let n = 0, diff = 0
const groups = {}
for (let mi = 0; mi < models.length; mi++) for (let ni = 0; ni < notes.length; ni++) for (let ei = 0; ei < extra.length; ei++) {
  // 組み合わせを間引く（全部は 9600 通り）。決定的に 1/2
  if ((mi + ni + ei) % 2) continue
  const m = models[mi], note = notes[ni], ex = extra[ei]
  const head = ['品名', '型式', 'メーカー', '数量', ...(ex ? [ex[0]] : []), '備考'].join('｜')
  const rows = [0, 1, 2, 3, 4, 5].map((i) => [`部品${i}`, i === 2 ? m : `P-${i}0`, 'メーカ', String(i + 1), ...(ex ? [ex[1][i]] : []), i === 2 ? note : ''].join('｜'))
  const t = T([head, ...rows].join('\n'))
  const o = old.parseBomPaste(t), r = neu.parseBomPaste(t)
  n++
  if (sig(o) !== sig(r)) {
    diff++
    const key = `${ex ? ex[0] + '[' + ex[1].slice(0, 3).join('/') + ']' : '(追加の列なし)'} 備考=${note || '(空)'}`
    const g = (groups[key] ??= { n: 0, ex: '' })
    g.n++
    if (!g.ex) g.ex = `${m}: old=${o.rows.map((x) => x.model).join(',')} new=${r.rows.map((x) => x.model).join(',')} | W: ${r.warnings.map((w) => w.slice(0, 40)).join(' / ')}`
  }
}
const byKind = {}
for (const [k, g] of Object.entries(groups)) { const kk = k.split(' 備考=')[0]; byKind[kk] = (byKind[kk] ?? 0) + g.n }
out.push(`組み合わせ ${n}、違った ${diff}`, JSON.stringify(byKind))
for (const [k, g] of Object.entries(groups).sort((a, b) => b[1].n - a[1].n)) out.push(`${g.n}\t${k}\n   ${g.ex}`)
fs.writeFileSync('results/n08_ordinary_real.out', out.join('\n') + '\n')
console.log(out.slice(0, 2).join('\n'))
console.log(out.slice(2, 40).join('\n'))
