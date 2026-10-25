// 画面で流すケースの抜粋 → cases/p21sel.json
import fs from 'node:fs'
const pick = []
const want = {
  p21a: ['A 「削除（確認済）」', 'A 「削除（生産中止）」', 'A 「削除（不要品）」', 'A 「削除（使用しないため）」', 'A 「削除（再設計のため）」', 'A 「削除（他案件へ流用）」', 'A 「削除（検討済）」', 'A 「削除（保留解除）」', 'A 「削除（PM確認済）」', 'A 「削除（客先指示）」', 'A 「削除お願いします」', 'A 「削除に変更」', 'A 「削除で」', 'A 「削除　済」', 'A 「削除（R012に置換）」', 'A-keep 「削除（保留）」', 'A-keep 「削除（しない）」', 'A-keep 「撤去（再取付）」', 'A-keep 「削除→保留」', 'A-ask 「削除ではない」', 'A-ask 「削除の手間なし」', 'A-newvalue 新の型式「→削除」', 'A-ordinary note 「削除に変更」（旧／新なし）', 'A-note two rows ask+del'],
  p21b: ['B-hdr 「Change Type」', 'B-hdr 「変更タイプ」', 'B-val 変更区分「取外し」', 'B-val 変更区分「廃番」', 'B-val 変更区分「削除(R012へ)」', 'B-val 変更区分「x」', 'B-val 変更区分「削除済」', 'B-hdr 「改訂区分」', 'B-hdr 「変更の種類」', 'B-hdr 「ECN区分」', 'B-ditto 「"」 under 削除', 'B-ditto 「〃」 under 削除', 'B-ord 「変更」列 ○/×（変更の有無）', 'B-ord 「区分」列 A/B/C/D（購買ランク）', 'B-ord 「区分」列 新規/流用/D', 'B-kind + note 削除 (both)'],
  p21c: ['C-model 「USB-A→USB-C」', 'C-model 「DVI→HDMI」', 'C-model 「DB9->RJ45」', 'C-model 「XLR→TRS」', 'C-model 「24VDC→12VDC」', 'C-model 「CAT5e→CAT6」', 'C-model 「USB-A→USB-C 変換ケーブル」', 'C-model 「UL1007 AWG22 (赤→黒)」', 'C-model 「1N4007 (>100V)」', 'C-model 「PT1/4>φ6」', 'C-model 「MY2N→MY4N-D2」', 'C-model 「L-0＞L-1」', 'C-qty 「4→6」', 'C-maker 「オムロン→三菱」', 'C-ord symbols'],
  p21d: ['D 「変更内容」=削除 + 備考=盤内', 'D 備考 | 「変更内容」=削除（順序逆）', 'D 「変更理由」=廃番のため + 備考=削除', 'D-ord 変更内容 + 備考（旧／新なし）', 'D 書き写し + 変更理由=変更なし + 備考=削除', 'D コメント + 変更内容'],
  p21e: ['E-same 「そのまま」', 'E-same 「No change」', 'E-same-qty 「-」', 'E-same 「ー」', 'E-amb copy=3 empty=3 dash=0', 'E-amb copy=3 empty=0 dash=3', 'E-amb copy=2 empty=7 dash=0', 'E-amb そのまま 3/3', 'E-all-dash'],
  p21f: ['F-dnp 備考「未実装品」', 'F-dnp 備考「未実装です」', 'F-dnp 備考「DNP 将来用」', 'F-dnp 備考「DNP/未実装」', 'F-dnp 部品名ふつう「DNP 反射フィルム」', 'F-dnp 部品名ふつう「DNP（大日本印刷）」', 'F-mach 第1号機|第2号機', 'F-mach Unit1|Unit2', 'F-mach UNIT1|UNIT2|UNIT3', 'F-kana qty 「ｽｳﾘﾖｳ」', 'F-kana qty 「ﾀﾞｲｽｳ」', 'F-kana 合計行 ｺﾞｳｹｲ', 'F-kana 合計行 全角 ゴウケイ'],
  p21g: ['G-csv tab in one cell', 'G-csv multi-line + comma-quoted', 'G-csv multi-line comma cell then comma cell same row', 'G-csv multi-line cell w/ many commas (narrow table)', 'G-tsv multi-line cell 6 lines with commas', 'G-tsv multi-line cell 3 lines with commas', 'G-csv inch 1/2" in model'],
  p21h: ['H1 ordinary Excel BOM with real notes', 'H2 ordinary with 変更内容 col', 'H3 ordinary with 区分 col (mixed)', 'H5 DNP column + note 未実装品', 'H6 machine qty', 'H7 spaces & hyphens in model'],
}
for (const [f, titles] of Object.entries(want)) {
  const all = JSON.parse(fs.readFileSync(`cases/${f}.json`, 'utf8'))
  for (const t of titles) { const c = all.find((x) => x[0] === t); if (c) pick.push([c[0], c[1]]); else console.log('MISSING', f, t) }
}
fs.writeFileSync('cases/p21sel.json', JSON.stringify(pick))
console.log(pick.length)
