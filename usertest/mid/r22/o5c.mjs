// o5c: 追加行 N（Rev.3 追加＋D → Rev.4 部品名でまとめ）を Rev.4 で却下 → Rev.3 を D で承認 → 設計が公開し直し（Rev.5）→ PM が承認。
//   購買の Excel 変更点：N の行は承認された Rev.5 の追加だけ（却下された系列の Rev.3「Rev 4 にまとめた」を出さない／出すなら指す先が分かる）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv, rowOf } from './nlib.mjs'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup(); const D = sel[1].id, qD = sel[1].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
await t.setCellKey(D, 'qtyNeeded', String(qD + 1)); log('Rev.3 →', (await t.publish('1')).slice(-24))
await t.setCellKey(N, 'name', '追加行N2'); log('Rev.4 →', (await t.publish('3')).slice(-24))
const pm = async (id, key, txt) => { await t.role('pm'); await t.press('7'); const r = key === 'y' ? await t.yes(id, txt) : await t.decide(id, 'Shift+Y', txt); log('PM', key, id, r.toast.slice(0, 60)) }
await pm(N, 'Y', 'Rev.4 却下'); await pm(D, 'y', 'Rev.3 承認')
await t.role('design'); await t.press('1'); log('republish →', (await t.publish('1')).slice(-30))
let p = await t.proj(); log('subs', c.subs(p), h.show(p, N).slice(0, 110)); checkInv('O5C-0', p)
await pm(N, 'y', 'Rev.5 承認'); p = await t.proj(); log('subs', c.subs(p)); checkInv('O5C-1', p)
check('O5C-1 N は公開（提出済・承認待ちなし）', rowOf(p, N).status === 'submitted' && !rowOf(p, N).flags.pmPending, h.show(p, N).slice(0, 120))
for (const role of ['purchasing', 'design', 'pm']) {
  const rows = await c.chg(role, N); log(role, '変更点 N', JSON.stringify(rows))
  if (role === 'purchasing') {
    const dangling = rows.filter((r) => /Rev 4 にまとめた/.test(r[3]))
    check('O5C-2 購買の変更点：却下された Rev.4 を指す「Rev 4 にまとめた」の行が出ない（購買に見えない Rev を指さない）', dangling.length === 0, JSON.stringify(rows))
    check('O5C-3 購買の変更点：承認された追加（最後の Rev）が内容つきで出る', rows.some((r) => /追加/.test(r[2])), JSON.stringify(rows))
  }
}
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
