// ラウンド23: 区分・対応・Action・ステータス・変更区分 などの列があるふつうの BOM（変更表ではない）が、1 行も消えないか。現行と r22 ビルド
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const CLEAR = ['変更区分', '変更種別', '設変区分', '対応区分', '更新区分', '更新種別', '改訂区分', 'ECN区分', '修正区分', '変更タイプ', 'Change Type', 'Rev区分', '区分(変更)']
const VAGUE = ['変更', '対応', 'Action', 'Change', '区分', '種別', '処置', '処置区分', 'ステータス', 'Status', '改訂', '設変']
const VS: Record<string, string[]> = {
  '○/×': ['○', '×', '○', '×', '○'],
  '要/不要': ['要', '不要', '要', '不要', '要'],
  '有/無': ['有', '無', '有', '無', '有'],
  '済/未/不要': ['済', '未', '不要', '済', '未'],
  'A/B/C/D': ['A', 'B', 'C', 'D', 'A'],
  'Y/N': ['Y', 'N', 'Y', 'N', 'Y'],
  'x/-': ['x', '-', 'x', '-', 'x'],
  '量産/試作/廃止': ['量産', '試作', '廃止', '量産', '試作'],
  '使用中/廃止/新規': ['使用中', '廃止', '新規', '使用中', '廃止'],
  '新規/継続/廃止予定': ['新規', '継続', '廃止予定', '新規', '継続'],
  '対応済/未対応/不要': ['対応済', '未対応', '不要', '対応済', '未対応'],
  '対応済/未対応/変更': ['対応済', '未対応', '変更', '不要', '対応済'],
  '新規/流用/廃止': ['新規', '流用', '廃止', '新規', '流用'],
  '購入/自作/廃止品': ['購入', '自作', '廃止品', '購入', '自作'],
  '標準/特注/取外し': ['標準', '特注', '取外し', '標準', '特注'],
  '変更なし/変更/不要': ['変更なし', '変更', '不要', '変更なし', '変更'],
  'OK/NG/削除': ['OK', 'NG', '削除', 'OK', 'NG'],
  '−/○/ー': ['−', '○', 'ー', '○', '−'],
  'ー/追加': ['ー', '追加', 'ー', '追加', 'ー'],
  '除外/対象': ['対象', '除外', '対象', '除外', '対象'],
  '〇/✕': ['〇', '✕', '〇', '✕', '〇'],
  '済/削除済': ['済', '削除済', '済', '削除済', '済'],
  '承認/却下/取消': ['承認', '却下', '取消', '承認', '却下'],
  'add/del/keep': ['add', 'del', 'keep', 'add', 'del'],
  'New/Del': ['New', 'Del', 'New', 'Del', 'New'],
  '更新/削除/新規 (マスタ)': ['更新', '削除', '新規', '更新', '削除'],
}
const out: any[] = []
const lines: string[] = []
for (const h of [...CLEAR, ...VAGUE]) for (const [vn, vals] of Object.entries(VS)) {
  const rows = [[h, '部品名', '型式', '数量'], ...vals.map((v, i) => [v, `P${i}`, `M-${i}`, '1'])]
  const r = parseBomPaste(rows.map((x) => x.join('\t')).join('\n'))
  const kept = r.rows.map((x: any) => x.name).join(',')
  const lost = vals.length - r.rows.length
  out.push({ h, vn, kept, lost })
  if (lost) lines.push(`${h} | ${vn} | lost ${lost} (kept ${kept})`)
}
console.log('cases', out.length, 'with lost rows', lines.length)
for (const l of lines) console.log(l)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/300-kind-ordinary' + (process.env.TAG ?? '') + '.json', JSON.stringify(out))
