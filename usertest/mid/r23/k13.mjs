// k13: 承認 ON で、正式依頼中の行を取消・置換（承認待ち）→ PM 承認 / 却下 と正式依頼取下げ
//   mode=approve: 承認で取消・置換が確定し、元の商社への取下げが購買に出る（4・F8・x）
//   mode=reject : 却下で正式依頼中のまま、取下げは付かない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.altPolicy !== '客先承認要' && !r.working)
const C = fr[0].id, R = fr[1].id
log('C', h.show(p, C)); log('R', h.show(p, R))
await t.role('design'); await t.press('1')
await t.goto(C); await t.press('Shift+Delete'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) } } log('C delete →', await t.toast())
log('R replace →', await t.replace(R, 'K13-NEW-1'))
log('publish →', await t.publish('1'))
p = await t.proj(); for (const id of [C, R]) log('pending', h.show(p, id), 'wd', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
check('K13-0 承認待ちのあいだは取消・置換も取下げもまだ（公開値のまま）', [C, R].every((id) => { const r = p.rows.find((x) => x.id === id); return r.status === 'formalRequested' && !r.flags.formalWithdrawn }), JSON.stringify([C, R].map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.flags.formalWithdrawn ?? null] })))
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has C,R', v7.includes(C), v7.includes(R))
if (mode === 'approve') {
  const y = await t.yes(C, '承認'); log('PM y →', y.toast)
  p = await t.proj(); const st = [C, R].map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.flags.formalWithdrawn ?? null] }); log('after approve', JSON.stringify(st))
  check('K13-1 承認で取消・置換が確定し、両方の行に元の商社への正式依頼取下げが付く', st.every(([, s, w]) => ['cancelled', 'replaced'].includes(s) && !!w), JSON.stringify(st))
  await t.role('purchasing'); await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has C,R', v4.includes(C), v4.includes(R))
  const seen = new Set(); await t.goto(v4[0]); for (let i = 0; i < 40; i++) { await t.press('F8'); await page.waitForTimeout(40); const cr = await t.curRow(); seen.add(cr) }
  log('F8 visited C,R', seen.has(C), seen.has(R))
  check('K13-2 購買の 4 と F8 で取消・置換の行の取下げに行き着く', v4.includes(C) && v4.includes(R) && seen.has(C) && seen.has(R), `v4=${v4.includes(C)},${v4.includes(R)} f8=${seen.has(C)},${seen.has(R)}`)
} else {
  const dec = await t.decide(C, 'Shift+Y', '客先未確定'); log('PM Shift+Y →', dec.toast)
  p = await t.proj(); const st = [C, R].map((id) => { const r = p.rows.find((x) => x.id === id); return [id, r.status, r.flags.formalWithdrawn ?? null, JSON.stringify(r.removal ?? null)] }); log('after reject', JSON.stringify(st))
  check('K13-3 却下で正式依頼中のまま、取下げは付かない（取消・置換は設計の作業中に戻る）', st.every(([, s, w]) => s === 'formalRequested' && !w), JSON.stringify(st))
  const newRow = p.rows.find((r) => r.replaces === R); log('置換で作った行', newRow ? h.show(p, newRow.id) : '-')
  check('K13-4 却下した置換で作った新しい行が、購買に見える行（提出済・見積待ち）として残らない', !newRow || newRow.status === 'draft' || newRow.publishedRev == null, newRow ? `${newRow.id} ${newRow.status} rev=${newRow.publishedRev}` : '-')
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k13-' + mode)
summary(); await t.close()
