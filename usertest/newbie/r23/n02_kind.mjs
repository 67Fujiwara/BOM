// ラウンド23 n02: 変更区分の見出し（はっきり／あいまい）× 値の語彙の組。ふつうの BOM にたまたまある 区分/ステータス/対応 の列。旧 68e45f7 と新を比べる
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const heads = { clear: ['変更区分', '変更種別', '変更タイプ', '変更種類', '設変区分', '更新区分', '更新種別', 'ECN区分', '改訂区分', '修正区分', 'Change Type', 'ChangeType', 'Rev区分', '対応区分'], vague: ['更新', 'ステータス', 'Status', '対応', 'Action', 'Change', '区分', '変更', '種別', '処置', '改訂', '設変', '状態', '変更有無', 'CHG', '修正', 'ECO', 'ステータス(変更)', '変更内容区分', '部品区分', '調達区分', '手配区分', '仕様区分', '承認ステータス', 'ステータス区分', '更新ステータス'] }
// 値の組：各 [値...]。del=削除のはずの値（行が消えてよい）を d: で示す
const sets = {
  std: ['追加', '変更', '削除', '追加'],
  mixed_unknown: ['型式変更', '削除', '追加', '据え置き'],
  mixed_unknown2: ['数量変更', '削除', '継続使用', '変更あり'],
  en_std: ['Add', 'Change', 'Remove', 'No change'],
  en_std2: ['New', 'Delete', 'Modify', 'Same'],
  en_abbr: ['ADD', 'CHG', 'DEL', 'CHG'],
  lifecycle: ['新規', '継続', '廃止', '継続'],
  lifecycle2: ['量産', '試作', '廃止', '量産'],
  lifecycle3: ['量産中', '生産中止', 'EOL', 'NRND'],
  ox: ['○', '×', '○', '○'],
  ox2: ['○', '○', '×', '○'],
  xonly: ['', '×', '', ''],
  donly: ['D', 'D', 'D', 'D'],
  done: ['済', '未', '対応中', '不要'],
  done2: ['済', '済', '済', '不要'],
  order: ['発注済', '手配中', '取消', '保留'],
  order2: ['手配', '保留', 'キャンセル', '手配'],
  apv: ['承認', '却下', '承認', '保留'],
  okng: ['OK', 'NG', 'OK', 'OK'],
  kubun: ['購入品', '加工品', '流用', '新規'],
  kubun2: ['購入', '外注', '支給', '廃止'],
  kubun3: ['汎用', '専用', '流用', '不要'],
  mixed_del: ['追加', '削除', '型式変更', '削除'],
  mixed_del_en: ['Add', 'Remove', 'Replace', 'Delete'],
  hold: ['変更', '削除（保留）', '追加', '継続'],
  holdA: ['変更', '削除予定', '追加', '継続'],
  noword: ['要', '不要', '要', '要'],
  add_only: ['追加', '追加', '変更', '追加'],
  del_only: ['削除', '削除', '削除', '削除'],
  dit: ['追加', '〃', '削除', '〃'],
  none: ['', '', '', ''],
}
const mk = (head, vals) => T(`品名｜型式｜メーカー｜数量｜${head}
リレー｜MY4N-D2｜オムロン｜4｜${vals[0]}
タイマ｜H3CR-A8｜オムロン｜1｜${vals[1]}
端子台｜XW2B-20G4｜オムロン｜4｜${vals[2]}
ヒューズ｜F-5A｜ミツミ｜3｜${vals[3]}`)
const mkChange = (head, vals) => T(`${head}｜品名｜型式（旧）｜型式（新）｜数量
${vals[0]}｜リレー｜MY2N｜MY4N-D2｜4
${vals[1]}｜タイマ｜H3CR-A8｜｜1
${vals[2]}｜端子台｜｜XW2B-20G4｜4
${vals[3]}｜ヒューズ｜F-5A｜｜3`)
const sig = (res) => res.rows.map((r) => r.name || r.model).join(',') + (res.warnings.length ? ' W:' + res.warnings.map((w) => w.slice(0, 18)).join('/') : '')
const out = []
let diffN = 0
const tab = {}
for (const [type, hs] of Object.entries(heads)) for (const h of hs) for (const [sn, vals] of Object.entries(sets)) for (const [shape, f] of [['ordinary', mk], ['change', mkChange]]) {
  const t = f(h, vals)
  const o = old.parseBomPaste(t), n = neu.parseBomPaste(t)
  const so = o.rows.length, sn2 = n.rows.length
  const key = `${type}|${shape}|${sn}`
  const line = `${type} ${shape} 見出し=${h} 値=${sn}[${vals.join('/')}] old=${so}行(${o.rows.map((r) => r.name || r.model).join(',')}) new=${sn2}行(${n.rows.map((r) => r.name || r.model).join(',')})`
  out.push(line + (so !== sn2 ? '  <<DIFF' : ''))
  if (so !== sn2) { diffN++; (tab[key] ??= []).push(`${h}:${so}→${sn2}`) }
}
fs.writeFileSync('results/n02_kind.out', out.join('\n') + '\n\nDIFFN ' + diffN + '\n' + Object.entries(tab).map(([k, v]) => `${k}: ${v.join(' ')}`).join('\n') + '\n')
console.log('total', out.length, 'diff', diffN)
for (const [k, v] of Object.entries(tab)) console.log(k, v.join(' ').slice(0, 300))
