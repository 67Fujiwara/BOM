// ラウンド23 n04: 矢印の型式（DVI→HDMI）が「変更の証拠があるときだけ」分けられるか。ふつうの BOM・備考・区分の列・追加の行・見出し「旧→新」
import fs from 'node:fs'
import { loadParsers, T } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const models = ['DVI→HDMI', 'USB-A→USB-C', 'HDMI→VGA', 'RS232C→RS485', 'XLR→TRS', 'M12→RJ45', 'AC→DC', '24V→5V']
const notes = ['', '位置', '交換用', '追加', '修正', '銘板あり', '変更あり', '代替品あり', '代替可', '置換用', '旧品番 ABC-1', '旧品あり', '旧型は廃止', '変更前の型式は不明', '差し替え不可', 'ホスト→デバイス', '配線: 端子台→PLC', 'A→B', '1→2', '型式変更', '型番変更', '変更後の型式', '客先支給', '変換アダプタ', '予備', '位置変更あり', '→', '交換品']
const kinds = [null, ['ステータス', ['量産', '試作', '廃止', '量産']], ['ステータス', ['新規', '継続', '廃止', '継続']], ['区分', ['購入品', '加工品', '流用', '新規']], ['変更区分', ['追加', '追加', '変更', '追加']], ['変更区分', ['追加', '削除', '変更', '追加']], ['対応', ['済', '未', '不要', '済']]]
const out = []
const bad = { 'ordinary: old keep → new split': [], 'ordinary: split in both (68e45f7も)': [] }
let n = 0
for (const m of models.slice(0, 4)) for (const note of notes) for (const k of kinds) {
  const head = ['品名', '型式', 'メーカー', '数量', ...(k ? [k[0]] : []), '備考'].join('｜')
  const rows = [0, 1, 2, 3].map((i) => [`部品${i}`, i === 1 ? m : `P-${i}`, 'メーカ', String(i + 1), ...(k ? [k[1][i]] : []), i === 1 ? note : ''].join('｜'))
  const t = T([head, ...rows].join('\n'))
  const o = old.parseBomPaste(t), r = neu.parseBomPaste(t)
  const g = (res) => res.rows.find((x) => x.name === '部品1')?.model ?? '(row gone)'
  n++
  const line = `${m} 備考=${note || '(空)'} 列=${k ? k[0] + '[' + k[1].join('/') + ']' : '無し'} old=${g(o)} new=${g(r)}`
  out.push(line)
  if (g(o) === m && g(r) !== m) bad['ordinary: old keep → new split'].push(line)
  else if (g(r) !== m && !k) bad['ordinary: split in both (68e45f7も)'].push(line)
}
// 変更図：追加の行の矢印の型式
const chg = []
for (const [h, kind] of [['変更区分', '追加'], ['変更区分', '変更'], ['更新区分', '追加'], ['Change Type', 'Add']]) for (const m of models.slice(0, 3)) {
  const t = T(`${h}｜品名｜型式（旧）｜型式（新）｜数量\n変更｜リレー｜MY2N｜MY4N-D2｜4\n${kind}｜アダプタ｜｜${m}｜1\n削除｜タイマ｜H3CR-A8｜｜1`)
  const t2 = T(`${h}｜品名｜型式｜数量\n変更｜リレー｜MY4N-D2｜4\n${kind}｜アダプタ｜${m}｜1\n削除｜タイマ｜H3CR-A8｜1`)
  for (const [lbl, tx] of [['旧新あり', t], ['型式のみ', t2]]) {
    const o = old.parseBomPaste(tx), r = neu.parseBomPaste(tx)
    chg.push(`${h}/${kind}/${lbl} ${m}: old=${o.rows.map((x) => x.model).join(',')} new=${r.rows.map((x) => x.model).join(',')}`)
  }
}
fs.writeFileSync('results/n04_arrows.out', out.join('\n') + '\n\nCHANGE-SHEET\n' + chg.join('\n') + '\n\nBAD\n' + Object.entries(bad).map(([k, v]) => `${k} (${v.length})\n  ` + v.slice(0, 60).join('\n  ')).join('\n') + '\n')
console.log(n, Object.entries(bad).map(([k, v]) => k + ' ' + v.length).join(' / '))
console.log(chg.join('\n'))
