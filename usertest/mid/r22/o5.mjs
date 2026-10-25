// o5: 購買の Excel（社内／保管用）に、承認されていない行（未公開の下書き・却下で下書きに戻った追加行・承認待ちの追加行）が出ないか
//   mode=draft : 設計が行 N を足しただけ（未提出）。購買・PM の Excel（社内・保管用）と画面の各ビュー
//   mode=rej   : 承認 ON。N を足して公開（承認待ち）→ PM が却下（下書きに戻る）
//   mode=pend  : 承認 ON。N を足して公開（承認待ちのまま）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { rowOf } from './nlib.mjs'
const mode = process.argv[2] ?? 'draft'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
let N
if (mode === 'draft') {
  await t.open('design'); await t.press('1')
  N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
} else {
  const sel = await c.setup(); await t.press('1')
  N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
  log('publish →', await t.publish('1'))
  if (mode === 'rej') { await t.role('pm'); await t.press('7'); log('PM reject →', (await t.decide(N, 'Shift+Y', '不要')).toast) }
}
let p = await t.proj(); log('N', h.show(p, N), 'publishedRev', rowOf(p, N).publishedRev)
for (const role of ['purchasing', 'pm']) {
  await t.role(role)
  const seen = []
  for (let v = 1; v <= 9; v++) { await t.press(String(v)); if ((await t.viewRows()).includes(N)) seen.push(v) }
  log(role, 'views containing N', JSON.stringify(seen))
  for (const [idx, nm] of [[0, '社内'], [2, '保管用']]) {
    const ex = await c.excel(idx); const bom = ex.find((s) => s.sh === 'BOM'); const row = bom.rows.find((r) => r[0] === N)
    log(role, nm, 'BOM N row', JSON.stringify(row ?? null)?.slice(0, 160))
    if (role === 'purchasing' && mode === 'pend') check(`O5-${mode}-${role}-${nm} 購買の${nm} Excel の BOM に承認待ちの追加行 N が出ない`, !row, JSON.stringify(row ?? null)?.slice(0, 120))
    else if (role === 'purchasing') log('INFO', `下書き（${mode === 'rej' ? '却下で戻った' : '未提出'}）の N は購買の${nm} Excel の BOM に`, row ? '出る（状態「下書き」・ボール設計。画面の 1・2 と同じ）' : '出ない')
    else log('INFO PM', nm, !!row)
  }
}
await t.role('purchasing'); const rq = await h.requestTo(null).catch((e) => ({ f: [], msg: 'ERR ' + e.message }))
check(`O5-${mode}-rough 概算見積の依頼書に N が出ない`, !rq.f.some((f) => f.ids.includes(N)), rq.msg)
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
