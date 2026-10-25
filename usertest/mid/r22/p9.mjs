// p9: 商社を集約（確認パネル → 適用）。承認要の行は PM の 7 に載る → y／Shift+Y。取消（Ctrl+Z）・もう一度集約・取引停止の商社が候補に出ない
//   usage: node p9.mjs [combo=0] [stop]
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck, importWs, scanViews } from './plib.mjs'
import { inv } from './nlib.mjs'
const combo = Number(process.argv[2] ?? 0); const stopFirst = process.argv[3] === 'stop'; const tag = `P9-${combo}${stopFirst ? 's' : ''}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
if (stopFirst) { log('stop S3 →', await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)) })); await t.role('design') }
let p = await t.proj(); const before = Object.fromEntries(p.rows.map((r) => [r.id, [r.status, r.adoptedSupplierId ?? null]]))
await t.cmd('商社を集約'); await page.waitForTimeout(200); let pn = await t.panel(); log('options', JSON.stringify(pn?.options?.map((o) => o.slice(0, 80))))
check(`${tag}-1 集約の候補に undefined がなく、${stopFirst ? '取引停止のミスミが出ない' : '候補が出る'}`, !!pn && !JSON.stringify(pn).includes('undefined') && (!stopFirst || !(pn.options ?? []).some((o) => o.includes('ミスミ'))), JSON.stringify(pn?.options?.map((o) => o.slice(0, 60))))
for (let k = 0; k < combo; k++) await page.keyboard.press('ArrowDown')
const chosenLabel = pn?.options?.[combo]; await page.keyboard.press('Enter'); await page.waitForTimeout(250)
const pn2 = await t.panel(); log('after Enter panel', JSON.stringify(pn2 ? { kind: pn2.kind, title: pn2.title } : null), 'toast', (await t.toast()).slice(0, 100))
log('confirm options', JSON.stringify(pn2?.options))
if (pn2) { if (pn2.options?.[0] === 'やめる') await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(400) }
if (await t.panel()) { await page.keyboard.press('Escape') }
const toast = await t.toast(); log('toast', toast)
p = await t.proj(); const after = Object.fromEntries(p.rows.map((r) => [r.id, [r.status, r.adoptedSupplierId ?? null]]))
const changed = p.rows.filter((r) => before[r.id][1] !== (r.adoptedSupplierId ?? null) || before[r.id][0] !== r.status)
const pend = p.rows.filter((r) => r.flags.pmPending); const m = toast.match(/集約: (\d+) 行を付け替え（PM承認待ち (\d+)/)
log('changed', changed.length, 'pending', pend.length, 'toast n/pend', m?.slice(1, 3))
check(`${tag}-2 知らせの件数（付け替え・承認待ち）が実際の変化と一致する`, !m || (Number(m[1]) === changed.length && Number(m[2]) === pend.length), `toast=${toast.slice(0, 90)} changed=${changed.length} pend=${pend.length}`)
const labelIds = (chosenLabel ?? '').split(' :: ')[0].split(' + ')
check(`${tag}-3 付け替えた行は選んだ商社（${labelIds.join('・')}）のどれかに集約される`, changed.every((r) => r.status !== 'selected' || !r.adoptedSupplierId || ['S1', 'S2', 'S3'].includes(r.adoptedSupplierId)), '')
let iv = inv(p); check(`${tag}-4 不変条件`, iv.length === 0, iv.join(' | '))
// PM: 承認要の行を y と Shift+Y
await t.role('pm'); await t.press('7'); const ids = (await t.viewRows()).filter((id) => p.rows.find((r) => r.id === id)?.flags.pmPending)
log('PM 7 pending rows', ids.length)
let nOk = 0, nRej = 0
for (const [i, id] of ids.slice(0, 6).entries()) {
  const a = before[id]; const r = i % 2 === 0 ? await t.yes(id, '集約を承認') : await t.decide(id, 'Shift+Y', '集約は戻す')
  p = await t.proj(); const rr = p.rows.find((x) => x.id === id)
  log('  ', id, i % 2 === 0 ? 'y' : 'Y', '→', r.toast.slice(0, 50), '|', rr.status, rr.adoptedSupplierId ?? '-', 'before', JSON.stringify(a))
  if (i % 2 === 0) { nOk++; check(`${tag}-5a ${id} 承認で集約の商社のまま選定済`, rr.status === 'selected' && !rr.flags.pmPending && !!rr.adoptedSupplierId, `${rr.status} ${rr.adoptedSupplierId}`) }
  else { nRej++; check(`${tag}-5b ${id} 却下で承認待ちが外れ、選定者のボール（見積済に戻る）か元の商社`, !rr.flags.pmPending && (rr.status === 'quoted' || (rr.status === 'selected' && !!rr.adoptedSupplierId)), `${rr.status} ${rr.adoptedSupplierId} ball=${'?'}`) }
}
p = await t.proj(); iv = inv(p); check(`${tag}-6 不変条件（決定のあと）`, iv.length === 0, iv.join(' | '))
const sk = await stuck(t); check(`${tag}-7 固まる行がない`, sk.length === 0, sk.slice(0, 4))
// Ctrl+Z（設計）：自分の操作だけ戻る。例外なし
await t.role('design'); await page.keyboard.press('Control+z'); await page.waitForTimeout(150); log('undo →', (await t.toast()).slice(0, 80)); await t.role('pm'); await t.press('7')
p = await t.proj(); iv = inv(p); check(`${tag}-8 Ctrl+Z のあとも不変条件`, iv.length === 0, iv.join(' | '))
const bad = await scanViews(t, ['design', 'purchasing', 'pm'], [2, 4, 7, 8]); check(`${tag}-9 文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
errs(t, tag + '-10'); summary(); await t.close()
