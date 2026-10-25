// n9: 承認 ON。1 つの変更セットで設計の項目をすべて変える → 承認 → 3 役割の社内 Excel「変更点」に全項目が出るか（N19-13）
//   rows: D＝回路記号・図面番号・分類・部品名・型式・メーカ・単位・入数・メーカ指定・代替可否・必要日(前倒し)・必要日(固定)・規格・備考、C＝必要数・調達区分・指定先
//   mode=approve / reject（却下した Rev は設計・PM にだけ出る。購買には出ない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { rowOf } from './nlib.mjs'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const C = sel[0].id, D = sel[1].id
log('C', C, 'D', D)
await t.press('1'); await t.showCol('ref', 'drawing', 'category', 'unit', 'packQty', 'makerLock', 'altPolicy', 'needOffset', 'needDateFixed', 'tags', 'note', 'procurement', 'designated')
const sets = [
  [D, 'ref', 'ZR9'], [D, 'drawing', 'DWG-9-001'], [D, 'category', '特殊'], [D, 'name', '名称変更D'], [D, 'model', 'MODEL-D9'], [D, 'maker', 'メーカD9'], [D, 'unit', 'パック'], [D, 'packQty', '3'],
  [D, 'makerLock', '指定'], [D, 'altPolicy', '不可'], [D, 'needOffset', '-3'], [D, 'tags', 'UL508'], [D, 'note', '特記D'],
  [C, 'qtyNeeded', '31'], [C, 'procurement', '指定商社'], [C, 'designated', '立花エレテック'],
]
for (const [id, k, v] of sets) { const m = await t.setCellKey(id, k, v); if (/EDIT-ERR|エラー|できません|不正|選べ/.test(m)) log('  set', id, k, v, '→', m.slice(0, 140)) }
// 必要日(固定): 日付
{ const m = await t.setCellKey(D, 'needDateFixed', '2026-12-01'); log('  needDateFixed →', m.slice(0, 120)) }
let p = await t.proj(); const rd = rowOf(p, D)
log('D working', JSON.stringify(rd.working ?? null).slice(0, 400)); log('C working', JSON.stringify(rowOf(p, C).working ?? null))
log('publish →', await t.publish('3')); p = await t.proj(); log('subs', c.subs(p), 'D pa', JSON.stringify(rowOf(p, D).pendingApproval ?? null).slice(0, 400))
const n = p.submissions.at(-1).rev
if (mode === 'approve') { await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(D, '全項目の変更を承認')).toast) } else { await t.role('pm'); await t.press('7'); log('PM Shift+Y →', (await t.decide(D, 'Shift+Y', '却下')).toast) }
p = await t.proj(); log('after', c.subs(p), h.show(p, D)); log('D now', JSON.stringify({ ref: rowOf(p, D).ref, drawing: rowOf(p, D).drawing, category: rowOf(p, D).category, name: rowOf(p, D).name, model: rowOf(p, D).model, maker: rowOf(p, D).maker, unit: rowOf(p, D).unit, packQty: rowOf(p, D).packQty, makerLock: rowOf(p, D).makerLock, altPolicy: rowOf(p, D).altPolicy, needOffset: rowOf(p, D).needOffset, needDateFixed: rowOf(p, D).needDateFixed, tags: rowOf(p, D).tags, note: rowOf(p, D).note }))
const LABELS = { D: ['回路記号', '図面番号', '分類', '部品名', '型式', 'メーカ', '単位', '入数', 'メーカ指定', '代替可否', '必要日(前倒し)', '必要日(固定)', '規格', '備考'], C: ['必要数', '調達区分', '指定先'] }
for (const role of ['design', 'purchasing', 'pm']) {
  for (const [key, id] of [['D', D], ['C', C]]) {
    const rows = await c.chg(role, id); const line = rows.find((r) => String(r[0]) === String(n)); log(role, id, '変更点', JSON.stringify(rows))
    if (role === 'purchasing' && mode === 'reject') { check(`N9-${role}-${id} 購買には却下した Rev は出ない`, !line, JSON.stringify(line ?? null)); continue }
    const miss = LABELS[key].filter((l) => !(line && new RegExp(l.replace(/[()]/g, '\\$&') + ': ').test(line[2])))
    check(`N9-${role}-${id} 変更点の内容にすべての変更項目（${LABELS[key].length} 項目）が出る`, !miss.length, 'missing: ' + miss.join(',') + ' | ' + (line?.[2] ?? 'no line'))
  }
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
