// o3c: 新しく足した支給品・社内在庫の行（承認 OFF／ON）。公開後の状態・ボール・各ビュー・購買待ち・見積済の分母（U20-01 の新規行版）
//   usage: node o3c.mjs off|on
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { rowOf } from './nlib.mjs'
const mode = process.argv[2] ?? 'off'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
await t.open('design'); log('publish drafts →', (await t.publish('1')).slice(0, 60))
if (mode === 'on') { await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制')); await t.role('design') }
await t.press('1')
const waitOf = async () => { await t.role('purchasing'); const s = await t.lamps(); const prog = (await page.getByTestId('quote-progress').textContent().catch(() => '')) ?? ''; return { wait: Number((s.match(/購買待ち\s*(\d+)/) ?? [])[1]), prog } }
const w0 = await waitOf(); log('before', JSON.stringify(w0)); await t.role('design')
const S = await h.addRow('R080', '支給品S', 'SUP-100', 'オムロン', '支給品', '', '3')
const K = await h.addRow(S, '社内在庫K', 'STK-200', 'オムロン', '社内在庫', '', '2')
log('publish →', (await t.publish('1')).slice(0, 80))
if (mode === 'on') { await t.role('pm'); await t.press('7'); for (const id of [S, K]) { const y = await t.yes(id, '追加を認める'); log('PM y', id, y.toast.slice(0, 60)) } }
let p = await t.proj(); log('S', h.show(p, S).slice(0, 140)); log('K', h.show(p, K).slice(0, 140))
const w1 = await waitOf(); log('after', JSON.stringify(w1))
for (const id of [S, K]) {
  await t.role('purchasing')
  const vs = {}; for (const v of [3, 8, 9]) { await t.press(String(v)); vs[v] = (await t.viewRows()).includes(id) }
  const ball = await h.ballOf(id); const r = rowOf(await t.proj(), id)
  log(id, r.procurement, 'st', r.status, 'ball', ball, 'views', JSON.stringify(vs))
  check(`O3C-${mode}-${id}-1 ${r.procurement}の新規行：購買の 3・8・9 に出ない（商社に頼まない）`, !vs[3] && !vs[8] && !vs[9], JSON.stringify(vs) + ' st=' + r.status)
  check(`O3C-${mode}-${id}-2 ${r.procurement}の新規行：購買のボールでない`, ball !== 'purchasing', `ball=${ball}`)
}
check(`O3C-${mode}-3 購買待ちが 2 行分増えていない`, w1.wait - w0.wait < 2, `${w0.wait} → ${w1.wait}`)
const den = (x) => Number((x.prog.match(/\/(\d+)/) ?? [])[1]); check(`O3C-${mode}-4 見積済の分母に含めない`, den(w1) === den(w0), `${w0.prog} → ${w1.prog}`)
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
