// ラウンド22: 変更区分の列（見出しが 変更区分／設変区分／変更種別／改訂区分／Change／対応／区分 など）に、削除の行(削除)＋値の語を 1 つ混ぜた表を取り込む。
// 削除の行が外れるか（期待）と、他の行が全部残るか。r21b（見出しだけで区分の列）と現行（値が区分の語ばかりのとき）の差。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
const HEAD = ['変更区分', '設変区分', '変更種別', '改訂区分', 'ECN区分', 'Change', 'Change Type', 'Action', '対応', '変更', '区分', '設変', '処置', '更新区分', 'ステータス', 'Status']
const VALS = ['修正', '変更あり', '設変', '改訂', '更新', '置換', '代替', '仕様変更', '型式変更', '数量変更', '移設', '増', '減', '新設', '既存', '現行', '旧', '新', '共通', '変更無', '無', 'New', 'Mod', 'Modify', 'Modified', 'Chg', 'Change', 'Update', 'Add', 'Added', 'Same', 'Unchanged', 'Existing', 'ADD', 'MOD', 'REV', 'N', 'C', 'A', 'U', 'M', '○', '●', '済', '未', '要', '確認', '採用', '保留', '承認', '確定', '仮', '新規追加', '追加予定', '変更予定', '要変更', '変更済', '追加済', '継続使用', '流用', '従来通り', '変更なし', '-', '－', '']
const DELV = ['削除', 'Delete', 'Del', 'D', '廃止', '除外']
const out: any[] = []
const sum: Record<string, { kept: number; total: number; missed: string[] }> = {}
for (const h of HEAD) for (const dv of DELV) {
  const key = `${h}`; sum[key] ??= { kept: 0, total: 0, missed: [] }
  for (const v of VALS) {
    const rows = [[h, '部品名', '型式', '数量'], ['追加', 'A', 'M-1', 1], [v, 'B', 'M-2', 1], [dv, 'DEL', 'M-3', 1], [v, 'C', 'M-4', 1]]
    const r = parseBomPaste(rows.map((x) => x.join('\t')).join('\n'))
    const names = r.rows.map((x: any) => x.name)
    const delGone = !names.includes('DEL'), othersKept = ['A', 'B', 'C'].every((n) => names.includes(n))
    sum[key].total++
    if (delGone && othersKept) sum[key].kept++
    else sum[key].missed.push(`${v || '(空)'}/${dv}:${delGone ? '' : '削除残'}${othersKept ? '' : '良い行消失'}`)
    out.push({ h, v, dv, delGone, othersKept, n: r.rows.length })
  }
}
let totalMiss = 0
for (const [h, s] of Object.entries(sum)) { totalMiss += s.total - s.kept; console.log(`${h}: 期待どおり ${s.kept}/${s.total}` + (s.missed.length ? '  例外: ' + s.missed.slice(0, 12).join(' ｜ ') : '')) }
console.log('total mismatches', totalMiss, '/', out.length, ' 良い行消失', out.filter((o) => !o.othersKept).length, ' 削除残', out.filter((o) => !o.delGone).length)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/241-kind-vocab' + (process.env.TAG ?? '') + '.json', JSON.stringify(out))
