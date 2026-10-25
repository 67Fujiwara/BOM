// f1: 乱数の操作列（シード固定）。設計・購買・PM・商社マスタの操作をキーボードで 1 件ずつ行い、毎回「状態の不変条件」を見る。
//   usage: node fz1.mjs <seed> [ops=40] [approval=0|1]
//   見る不変条件: nlib の inv() ／ 支給品・社内在庫が採用・発注数・正式依頼を持たない ／ 見積対象で選定済以降の行に採用がある ／
//     ボールの役割のビューに載る（stuck）／ 文字 undefined・NaN ／ console error ／ 総額が NaN でない。違反したら直前の操作列を出す
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { inv } from './nlib.mjs'
import { scanViews, stuck, importWs, BAD } from './plib.mjs'
const seed = Number(process.argv[2] ?? 1); const NOPS = Number(process.argv[3] ?? 40); const APPR = process.argv[4] === '1'
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const R = rng(seed * 7919 + 13); const pick = (a) => a[Math.floor(R() * a.length)]; const chance = (x) => R() < x
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const hist = []; let violations = 0; let simDay = 0
await t.open('design'); await t.showCol('procurement', 'designated')
if (APPR) { log('publish drafts →', (await t.publish('1')).slice(0, 60)); await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制')); await t.role('design') }
const ST = (src) => t.S(src)
async function rows(filter) { const p = await t.proj(); return p.rows.filter(filter) }
async function anyRow(filter) { const rs = await rows(filter); return rs.length ? pick(rs) : null }
const active = (r) => !['cancelled', 'replaced'].includes(r.status)
async function dismiss() { for (let i = 0; i < 3; i++) { if (await t.panel()) await page.keyboard.press('Escape'); else break } if ((await t.mode()) === 'edit') await page.keyboard.press('Escape') }
const OPS = {
  async edit_qty() { const r = await anyRow((r) => active(r)); if (!r) return 'none'; await t.role('design'); await t.press('1'); const m = await t.setCellKey(r.id, 'qtyNeeded', String(1 + Math.floor(R() * 60))); if (chance(0.7)) return r.id + ' ' + (await t.publish(pick(['1', '2', '3']))).slice(-30); return r.id + ' ' + m.slice(0, 30) },
  async switch_proc() { const r = await anyRow((r) => active(r) && !['ordered', 'received'].includes(r.status)); if (!r) return 'none'; const proc = pick(['相見積', '支給品', '社内在庫', '指定商社', '客先指定品']); await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated')
    if (proc === '指定商社') await t.setCellKey(r.id, 'designated', pick(['S1', 'S2', 'S3'])); if (proc === '客先指定品') await t.setCellKey(r.id, 'designated', 'オムロン / 客先承認 KS-9')
    const m = await t.setCellKey(r.id, 'procurement', proc); if (chance(0.8)) return r.id + '→' + proc + ' ' + (await t.publish('1')).slice(-30); return r.id + '→' + proc + ' ' + m.slice(0, 30) },
  async cancel_row() { const r = await anyRow((r) => active(r) && r.status !== 'draft'); if (!r) return 'none'; await t.role('design'); await t.press('1'); await t.goto(r.id); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) } await dismiss(); return r.id + ' ' + (await t.publish('1')).slice(-30) },
  async replace_row() { const r = await anyRow((r) => active(r) && r.status !== 'draft' && r.procurement === '相見積'); if (!r) return 'none'; await t.role('design'); await t.press('1'); const m = await t.replace(r.id, 'FZ-' + Math.floor(R() * 900 + 100)); await dismiss(); return r.id + ' ' + m.slice(0, 40) + ' / ' + (await t.publish('1')).slice(-30) },
  async add_row() { const r = await anyRow((r) => active(r)); await t.role('design'); await t.press('1'); const id = await h.addRow(r.id, '乱数行' + Math.floor(R() * 999), 'G3VM-61A1', 'オムロン', pick(['相見積', '支給品', '社内在庫']), '', String(1 + Math.floor(R() * 20))); await dismiss(); return id + ' ' + (chance(0.7) ? (await t.publish('1')).slice(-30) : 'unpublished') },
  async bulk() { await t.role('design'); await t.press('2'); return (await t.bulk()).slice(0, 60) },
  async pick_supplier() { const r = await anyRow((r) => r.status === 'quoted' && r.procurement === '相見積'); if (!r) return 'none'; await t.role('design'); const x = await h.adoptPick(r.id, 1 + Math.floor(R() * 3), '6', 'fuzz'); await dismiss(); return r.id + ' ' + x.toast.slice(0, 50) },
  async rough() { await t.role('purchasing'); const x = await h.requestTo(null); return x.msg.slice(0, 60) },
  async formal() { await t.role('purchasing'); return (await t.requestFormal()).slice(-60) },
  async formal_price() { const r = await anyRow((r) => ['formalRequested', 'formalQuoted'].includes(r.status) && r.adoptedSupplierId); if (!r) return 'none'; const p = await t.proj(); const q = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale); if (!q?.unitPrice) return 'noquote'
    await t.role('purchasing'); await t.press('8'); const mult = pick([1, 1, 1.05, 1.5, 3]); const m = await t.setCellKey(r.id, 'q.formalPrice@A', String(Math.round(q.unitPrice * mult))); await t.press('Escape'); await t.setCellKey(r.id, 'q.formalLeadDays@A', String(pick([3, 10, 30]))); await t.press('Escape'); await dismiss(); return r.id + ' x' + mult + ' ' + m.slice(0, 40) },
  async order() { const r = await anyRow((r) => r.status === 'formalQuoted' && !r.flags.formalDiff && !r.flags.pmPending); if (!r) return 'none'; await t.role('purchasing'); return r.id + ' ' + (await t.order(r.id)).slice(0, 50) },
  async receive() { const r = await anyRow((r) => r.status === 'ordered'); if (!r) return 'none'; await t.role('purchasing'); await t.press('3'); await t.goto(r.id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); await dismiss(); return r.id + ' ' + (await t.toast()).slice(0, 40) },
  async decline() { const r = await anyRow((r) => ['quoting', 'quoted'].includes(r.status) && r.procurement === '相見積'); if (!r) return 'none'; await t.role('purchasing'); const sid = pick(['S1', 'S2', 'S3']); const m = await h.decline(r.id, sid); await dismiss(); return r.id + ' ' + sid + ' ' + String(m).slice(0, 40) },
  async pm_decide() { await t.role('pm'); await t.press('7'); const ids = await t.viewRows(); if (!ids.length) return 'empty'; const id = pick(ids.slice(0, 8)); const k = pick(['y', 'y', 'Shift+Y', 'b']); await t.goto(id)
    if (k === 'b') { await page.keyboard.press('Enter'); await page.waitForTimeout(100); await page.keyboard.press('b'); await page.waitForTimeout(100); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('次点') } catch {} ; await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } await dismiss(); return id + ' b ' + (await t.toast()).slice(0, 50) }
    const r = k === 'y' ? await t.yes(id, 'fuzz') : await t.decide(id, 'Shift+Y', 'fuzz'); await dismiss(); return id + ' ' + k + ' ' + r.toast.slice(0, 50) },
  async toggle_approval() { await t.role('pm'); const on = (await t.proj()).settings.changeNeedsPmApproval; const m = await h.setting('changeNeedsPmApproval', on ? 'いいえ' : 'はい', 'fuzz'); await dismiss(); return (on ? 'OFF ' : 'ON ') + m.slice(0, 30) },
  async master_stop() { const sid = pick(['S1', 'S2', 'S3']); const on = (await t.ws()).suppliers.find((s) => s.id === sid)?.tradable; await t.role('purchasing'); const m = await importWs(t, (ws) => { ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable: !on } : s)) }); await dismiss(); return sid + (on ? ' 停止 ' : ' 再開 ') + m.slice(0, 30) },
  async master_remove() { const sid = pick(['S1', 'S2', 'S3']); await t.role('purchasing'); const m = await importWs(t, (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== sid) }); await dismiss(); return sid + ' 削除 ' + m.slice(0, 30) },
  async master_restore() { await t.role('purchasing'); const m = await importWs(t, (ws) => { for (const [id, name] of [['S1', '因幡電機'], ['S2', '立花エレテック'], ['S3', 'ミスミ']]) { if (!ws.suppliers.some((s) => s.id === id)) ws.suppliers.push({ id, name, tradable: true, handledMakers: [], kind: '商社', avl: true, performance: { ontime: 0.9, defect: 0.01 } }) } ws.suppliers = ws.suppliers.map((s) => ({ ...s, tradable: true })) }); await dismiss(); return '再開 ' + m.slice(0, 30) },
  async undo() { const role = pick(['design', 'purchasing', 'pm']); await t.role(role); await page.keyboard.press('Control+z'); await page.waitForTimeout(120); await dismiss(); return role + ' ' + (await t.toast()).slice(0, 40) },
  async next_day() { simDay += pick([1, 3, 8]); await t.setTime(new Date(Date.parse('2026-10-26T09:00:00+09:00') + simDay * 864e5).toISOString()); await page.waitForTimeout(100); return '+' + simDay + 'd' },
  async consolidate() { await t.role('design'); await t.cmd('商社を集約'); await page.waitForTimeout(150); const pn = await t.panel(); if (pn?.options?.length) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); const p2 = await t.panel(); if (p2?.kind === 'prompt') { try { await t.promptFill('集約') } catch {} ; await page.keyboard.press('Enter'); await page.waitForTimeout(150) } } await dismiss(); return (await t.toast()).slice(0, 60) },
  async withdraw_x() { const r = await anyRow((r) => r.flags.formalWithdrawn); if (!r) return 'none'; await t.role('purchasing'); await t.press('9'); await t.goto(r.id); await page.keyboard.press('x'); await page.waitForTimeout(100); await dismiss(); return r.id + ' ' + (await t.toast()).slice(0, 50) },
  async reload() { await t.reload(); return 'reload' },
  async excel() { const role = pick(['design', 'purchasing', 'pm']); await t.role(role); const ex = await c.excel(pick([0, 1, 2])); const bad = []; for (const s of ex) for (const row of s.rows) for (const v of row) { const x = String(v ?? ''); if (BAD.test(x)) bad.push(s.sh + ':' + x.slice(0, 30)) } if (bad.length) throw new Error('EXCEL-BAD ' + role + ' ' + bad.slice(0, 3).join(' | ')); return role + ' ' + ex.length + ' sheets' },
}
const W = { edit_qty: 5, switch_proc: 5, cancel_row: 2, replace_row: 2, add_row: 2, bulk: 3, pick_supplier: 3, rough: 2, formal: 3, formal_price: 5, order: 4, receive: 3, decline: 3, pm_decide: 8, toggle_approval: APPR ? 1 : 0, master_stop: 2, master_remove: 1, master_restore: 2, undo: 3, next_day: 2, consolidate: 1, withdraw_x: 2, reload: 1, excel: 2 }
const bag = Object.entries(W).flatMap(([k, w]) => Array(w).fill(k))
let lastKey = ''
async function verify(label) {
  const out = []
  const p = await t.proj(); const ws = await t.ws()
  out.push(...inv(p))
  const ids = new Set(ws.suppliers.map((s) => s.id))
  for (const r of p.rows) {
    if (!active(r)) continue
    const supplied = ['支給品', '社内在庫'].includes(r.procurement)
    if (supplied && r.adoptedSupplierId) out.push(`${r.id} ${r.procurement} なのに採用 ${r.adoptedSupplierId}`)
    if (supplied && ['formalRequested', 'formalQuoted', 'ordered'].includes(r.status)) out.push(`${r.id} ${r.procurement} なのに状態 ${r.status}`)
    if (!supplied && ['selected', 'formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status) && !r.adoptedSupplierId && !r.flags.formalWithdrawn) out.push(`${r.id} ${r.status} なのに採用なし`)
    if (r.adoptedSupplierId && !ids.has(r.adoptedSupplierId) && !['ordered', 'received'].includes(r.status)) out.push(`${r.id} マスタに無い商社 ${r.adoptedSupplierId} を採用（${r.status}）`)
    if (r.status === 'received' && !r.received) out.push(`${r.id} received だが received=false`)
  }
  const sk = await stuck(t); out.push(...sk.map((x) => 'stuck: ' + x))
  const money = await t.money().catch(() => ''); if (BAD.test(money)) out.push('総額に ' + money)
  if (t.errors.length) out.push('console: ' + t.errors.join(' | ').slice(0, 300))
  const key = out.join('|')
  if (out.length && key !== lastKey) { violations++; console.log(`VIOLATION after #${hist.length} (${label}):`, JSON.stringify(out.slice(0, 6))); console.log('  history:', JSON.stringify(hist.slice(-8))) }
  lastKey = key
  return out
}
let lastBad = ''
for (let i = 0; i < NOPS; i++) {
  const op = pick(bag); let res = ''
  try { res = await OPS[op]() } catch (e) { res = 'THROW ' + String(e.message).split('\n')[0].slice(0, 120); try { await dismiss() } catch {} }
  hist.push(`${i}:${op}: ${res}`); console.log(hist.at(-1))
  const v = await verify(op)
  if (v.length) { const key = v.join('|'); if (key === lastBad) { /* 同じ違反の繰り返しは数えない */ } lastBad = key; if (t.errors.length) t.errors.length = 0 }
  if (i % 6 === 5) { const role = pick(['design', 'purchasing', 'pm']); const bad = await scanViews(t, [role], [3, 4, 5, 7, 8, 9]); if (bad.length) { violations++; console.log(`VIOLATION views after #${i}:`, JSON.stringify(bad.slice(0, 4))); console.log('  history:', JSON.stringify(hist.slice(-8))) } }
}
check(`F1-${seed}${APPR ? 'a' : ''} 不変条件の違反なし（${NOPS} 操作）`, violations === 0, `violations=${violations}`)
summary(); await t.close()
