// ラウンド23 n03: ふつうの BOM（旧／新の列も変更図の列も無い）にたまたまある 区分/ステータス/対応/Action/Change/種別/処置 の列。旧 68e45f7 と新で取り込みが変わるか（乱数）
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
let seed = Number(process.argv[3] ?? 23)
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const N = Number(process.argv[2] ?? 4000)
const V = {
  ステータス: ['量産', '試作', '生産中止', 'EOL', 'NRND', '新規', '継続', '廃止', '承認済', '未承認', '保留', '発注済', '手配済', '手配中', '在庫あり', '入荷待ち', 'OK', 'NG', '済', '未', '対応中', '不要', '要', '○', '×', '-', '使用中', '追加', '変更'],
  Status: ['Active', 'Obsolete', 'NRND', 'EOL', 'New', 'Existing', 'Released', 'Draft', 'OK', 'NG', 'Done', 'Open', 'Removed', 'Deleted', 'Add', 'Keep'],
  区分: ['購入品', '加工品', '流用', '新規', '標準', '特注', '汎用', '専用', '機構', '電気', '制御', '支給', '外注', '消耗品', '共通', '追加', '削除', '不要', '×', 'D', 'M', 'E', '社内', '客先'],
  種別: ['電気', '機構', '制御', 'ケーブル', '消耗品', '追加', '変更', '削除', '新規', '不要', '×', 'D', '汎用'],
  処置: ['なし', '交換', '調整', '清掃', '点検', '不要', '×', '削除', '撤去', '要', '済'],
  対応: ['済', '未', '対応中', '不要', '要', '保留', '○', '×', '-', '追加', '変更', '削除', '完了', '手配済', '取外し', '廃止'],
  Action: ['Order', 'Hold', 'Cancel', 'Stock', 'Buy', 'Make', '-', 'OK', 'NG', 'None', 'Add', 'Delete', 'Remove', 'Replace', 'x', 'X', 'D'],
  Change: ['-', '', '○', '×', 'Y', 'N', 'Yes', 'No', '追加', '変更', '削除', 'Add', 'Del', 'x'],
  変更: ['-', '', '○', '×', 'あり', 'なし', '有', '無', '追加', '変更', '削除', 'x', '変更あり', '変更なし', '同上'],
  改訂: ['A', 'B', 'C', '-', '', 'Rev.1', 'Rev.2', '追加', '変更', '削除', '×'],
  設変: ['-', '', '○', '×', 'あり', 'なし', '追加', '変更', '削除', 'ECN-12'],
}
const names = ['リレー', 'タイマ', '端子台', 'ヒューズ', '電源', 'ファン', 'ランプ', '押釦', 'ケーブル', 'コネクタ', '抵抗', 'コンデンサ']
const models = ['MY4N-D2', 'H3CR-A8', 'XW2B-20G4', 'F-5A', 'S8VK-G06024', 'MF12-24', 'PL-24G', 'A22-10M', 'DVI→HDMI', 'USB-A→USB-C', 'R-10k', 'C-100u']
const diffs = []
let n = 0, same = 0
const byHead = {}
for (let i = 0; i < N; i++) {
  const h = pick(Object.keys(V))
  const k = 3 + Math.floor(rnd() * 8)
  const vals = []
  const bias = rnd()
  for (let r = 0; r < k; r++) vals.push(bias < 0.3 ? pick(V[h].slice(0, 6)) : pick(V[h]))
  const rows = vals.map((v, r) => `${pick(names)}${r}｜${pick(models)}${r}｜メーカ｜${1 + Math.floor(rnd() * 9)}｜${v}`)
  const colPos = Math.floor(rnd() * 3)
  const head = ['品名', '型式', 'メーカー', '数量']
  head.splice(2 + colPos, 0, h) // 品名,型式,[h],…
  const t = T([head.join('｜'), ...rows.map((r) => { const c = r.split('｜'); const v = c.pop(); c.splice(2 + colPos, 0, v); return c.join('｜') })].join('\n'))
  const o = old.parseBomPaste(t), nw = neu.parseBomPaste(t)
  n++
  if (o.rows.length === nw.rows.length && JSON.stringify(o.rows.map((r) => r.model + r.qtyNeeded)) === JSON.stringify(nw.rows.map((r) => r.model + r.qtyNeeded))) { same++; continue }
  const dropped = vals.filter((_, r) => !nw.rows.some((x) => x.name === undefined ? false : x.name.endsWith(String(r)) && x.name.startsWith(rows[r].split('｜')[0].replace(/\d+$/, ''))))
  ;(byHead[h] ??= []).push({ vals, o: o.rows.length, n: nw.rows.length, warn: nw.warnings.filter((w) => /が削除の/.test(w)).map((w) => w.slice(0, 30)).join('|') })
}
console.log('cases', n, 'same', same, 'diff', n - same)
const out = []
for (const [h, a] of Object.entries(byHead)) {
  const dn = a.filter((x) => x.n < x.o).length, up = a.filter((x) => x.n > x.o).length, other = a.length - dn - up
  out.push(`${h}: diff=${a.length} (新で行が減った ${dn}／増えた ${up}／同数で中身が違う ${other})`)
  for (const x of a.slice(0, 4)) out.push(`    ${x.o}→${x.n} 値=${x.vals.join('/')} ${x.warn}`)
}
console.log(out.join('\n'))
fs.writeFileSync('results/n03_ordinary_cols.out', `cases ${n} same ${same}\n` + out.join('\n') + '\n')
// 同数で中身が違う・増えた例
for (const [h, a] of Object.entries(byHead)) for (const x of a.filter((x) => x.n === x.o).slice(0, 3)) console.log('SAMECOUNT', h, x.vals.join('/'))
