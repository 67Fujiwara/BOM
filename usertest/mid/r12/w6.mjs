// w6: M-35（確認済みにして公開）、スコアの手計算、Undo（役割をまたぐ・公開済の値）、Excel の番号、指定先の誤記
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// --- スコアの手計算（データを読み、仕様 §8.1 の式で計算）
const data = await page.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return { p, sups: s.ws.suppliers } })
const today = '2026-10-23'
const addD = (d, n) => new Date(new Date(d).getTime() + n * 86400e3).toISOString().slice(0, 10)
const diff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400e3)
const need0 = addD(data.p.dueDate, -data.p.settings.processDays)
function hand(id) {
  const r = data.p.rows.find((x) => x.id === id); const need = r.needDateFixed ?? (r.needOffset ? addD(need0, r.needOffset) : need0)
  const qs = data.p.quotes.filter((q) => q.rowId === id && !q.stale && q.unitPrice > 0 && q.leadDays !== -1 && (!q.validUntil || q.validUntil >= today))
  const n = r.qtyNeeded; const rq = (q) => { let m = Math.max(n, q.moq ?? 0); if (r.unit !== 'パック' && r.packQty > 1) m = Math.ceil(m / r.packQty) * r.packQty; return m }
  const eff = (q) => q.unitPrice * rq(q) / n; const minE = Math.min(...qs.map(eff)); const base = r.quotedAt ?? today; const w = data.p.weights; const mg = data.p.settings.leadMarginDays || 5
  return qs.map((q) => { const s = data.sups.find((x) => x.id === q.supplierId); const price = 100 * minE / eff(q); const ld = q.stock === '在庫' ? 0 : q.leadDays; const m = diff(need, addD(base, ld)); const lead = m >= 0 ? 100 : Math.max(0, 100 * (1 + m / mg)); const rec = s?.onTimeRate == null ? 50 : s.onTimeRate * 100 - (s.defectRate ?? 0) * 200; const terms = (q.moq && q.moq > n) ? 100 * n / q.moq : 100; const tot = (price * w.price + lead * w.lead + rec * w.record + terms * w.terms) / (w.price + w.lead + w.record + w.terms); return `${q.supplierId}:${Math.round(tot * 10) / 10}(p${price.toFixed(1)} l${lead.toFixed(0)} r${rec.toFixed(0)} t${terms.toFixed(0)} rq${rq(q)} m${m})` }).sort()
}
const app = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((x) => x.id === id), s.ws.suppliers).map((x) => x.supplierId + ':' + x.total).sort() }, id)
const moqRow = data.p.rows.find((r) => r.status === 'quoted' && data.p.quotes.some((q) => q.rowId === r.id && !q.stale && q.moq > r.qtyNeeded))?.id
log('weights', JSON.stringify(data.p.weights), 'margin', data.p.settings.leadMarginDays, 'need0', need0, 'moqRow', moqRow)
for (const id of ['R020', 'R044', moqRow]) {
  const h = hand(id), a = await app(id); const r = data.p.rows.find((x) => x.id === id)
  log(id, `qty=${r.qtyNeeded}${r.unit} pack=${r.packQty} quotedAt=${r.quotedAt}`, JSON.stringify(data.p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays, q.moq, q.stock, q.validUntil])))
  log('  hand', h.join(' '), '\n  app ', a.join(' '))
  check('W6-score ' + id + ' 手計算とアプリのスコアが一致', JSON.stringify(h.map((x) => x.split('(')[0])) === JSON.stringify(a))
}
// --- M-35: 任意＋不可 → 警告を x → 公開 → 取込の代替提案
await t.press('1'); await t.showCol('makerLock')
log(await t.setCellKey('R015', 'makerLock', '任意')); log(await t.setCellKey('R015', 'altPolicy', '不可'))
await t.goto('R015'); await t.colKey('altPolicy'); await t.press('x'); log('x →', await t.toast())
log('publish →', await t.publish('2'))
await t.role('purchasing'); await t.cmd('見積回答を取り込む'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(80)
await page.getByTestId('import-text').fill(['行ID\t型式\t単価\t納期\tMOQ\t在庫区分\t有効期限\t代替型式\t代替メーカ\t代替単価\t代替納期', 'R015\tRSEL-2006W\t3000\t5\t\t取寄\t2026-12-31\tNF-2006\tコーセル\t2500\t5'].join('\n')); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(150)
log('import →', await t.toast()); let p = await t.proj()
check('M-35 メーカ指定＝任意（代替不可）の行は代替提案の下書きを作る', p.issues.some((i) => i.rowId === 'R015' && i.kind === '代替提案' && i.status === 'draft'))
// --- Excel の出力先（仕様: 1 社内 / 2 商社向け / 3 保管用）を数字で
await t.press('1'); await t.press('Control+e'); await page.waitForTimeout(100); const ex = await t.panel(); log('export options', JSON.stringify(ex?.options))
const before = t.downloads.length; await t.press('3'); await page.waitForTimeout(1200); log('after 3 → panel', JSON.stringify(await t.panel())?.slice(0, 60), 'toast', await t.toast(), 'dl', t.downloads.length - before)
// --- Undo: 設計が公開済の値を変えて公開 → Ctrl+Z
await t.role('design'); await t.press('1'); log(await t.setCellKey('R026', 'note', 'Undoテスト')); log('publish →', await t.publish('2'))
p = await t.proj(); const revs0 = p.submissions.length
await t.press('Control+z'); await page.waitForTimeout(100); log('design Ctrl+Z after publish →', await t.toast(), '| status:', (await t.status()).slice(0, 120))
p = await t.proj(); const r26 = p.rows.find((r) => r.id === 'R026'); log('R026 note', r26.note, 'working', JSON.stringify(r26.working ?? null), 'subs', revs0, '→', p.submissions.length)
check('W6-undo 公開済の値への Ctrl+Z は Rev を消さず、逆向きの作業中変更として積む（§1）', p.submissions.length === revs0 && r26.note === 'Undoテスト' && r26.working && r26.working.note !== 'Undoテスト', JSON.stringify(r26.working ?? null))
// 購買の Ctrl+Z は設計の操作を戻さない
await t.role('purchasing'); await t.press('Control+z'); await page.waitForTimeout(80); log('purchasing Ctrl+Z →', await t.toast())
// 履歴パネル「この変更を取り消す」
await t.cmd('履歴'); await page.waitForTimeout(100); const hp = await t.panel(); log('history (purchasing)', JSON.stringify(hp)?.slice(0, 300))
await t.press('Escape')
// --- 指定商社の誤記
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
log(await t.setCellKey('R044', 'procurement', '指定商社')); log(await t.setCellKey('R044', 'designated', '立花エレテク'))
const pr44 = await page.evaluate(async () => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return r.checkRow(p.rows.find((x) => x.id === 'R044'), s.ws.rules, p).map((x) => x.severity + ':' + x.message) })
log('R044 problems', pr44)
check('W6-des 指定先が商社マスタに無い（誤記）ときエラー / 警告になる（§3.1 商社マスタから選択）', pr44.length > 0, pr44.join(' / '))
summary(); await t.close()
