// v6: 集約（M-13）・パレット（M-14）・取込（M-24, M-35）・Excel（M-25, M-37）・拮抗の x
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1')
// 作業中・承認待ちの行を作る
log(await t.setCellKey('R030', 'note', '作業中'))
await t.goto('R047'); await t.press('Shift+A'); await page.waitForTimeout(60); log('adopt panel', JSON.stringify(await t.panel()), await t.toast()); await t.press('2'); await page.waitForTimeout(60); log('reason', JSON.stringify(await t.panel())?.slice(0,80)); await t.press('6'); await page.waitForTimeout(80); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('after', JSON.stringify(await t.panel())?.slice(0,80), await t.toast()); if (await t.panel()) await t.press('Escape')
let p = await t.proj(); const r47 = p.rows.find((r) => r.id === 'R047'); log('R047', r47.status, r47.adoptedSupplierId, JSON.stringify(r47.flags))
const moneyBefore = await t.money()
// 集約の試算を手で
const scoreOf = async (id) => t.page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === id); return sc.scoreRow(p, r, s.ws.suppliers).map((x) => ({ s: x.supplierId, ep: x.effectivePrice, lead: x.quote.stock === '在庫' ? 0 : x.quote.leadDays })) }, id)
await t.cmd('商社を集約'); await page.waitForTimeout(150)
let pn = await t.panel(); log('consolidate options:', JSON.stringify(pn?.options, null, 0))
await t.shot('v6-consolidate')
// 手計算: 対象は見積済・選定済で採用できる行
const rowsC = p.rows.filter((r) => (r.status === 'quoted' || r.status === 'selected') && !(r.working && Object.keys(r.working).length) && !r.flags.pmPending && r.procurement === '相見積' || (r.procurement === '指定商社' && ['quoted', 'selected'].includes(r.status)))
let cur = 0; const per = {}
for (const r of rowsC) { per[r.id] = await scoreOf(r.id); const sc = per[r.id]; const a = r.adoptedSupplierId ? sc.find((x) => x.s === r.adoptedSupplierId) : sc[0]; if (a) cur += a.ep * r.qtyNeeded }
const calc = (ids) => { let tot = 0, cov = 0; for (const r of rowsC) { const sc = per[r.id].filter((x) => ids.includes(x.s)); if (!sc.length) { const a = r.adoptedSupplierId ? per[r.id].find((x) => x.s === r.adoptedSupplierId) : per[r.id][0]; if (a) tot += a.ep * r.qtyNeeded; continue } cov++; tot += Math.min(...sc.map((x) => x.ep)) * r.qtyNeeded } return { tot: Math.round(tot), delta: Math.round(tot - cur), cov } }
log('hand: current', Math.round(cur), 'S1', JSON.stringify(calc(['S1'])), 'S2', JSON.stringify(calc(['S2'])), 'S3', JSON.stringify(calc(['S3'])), 'S1+S2', JSON.stringify(calc(['S1', 'S2'])), 'S1+S3', JSON.stringify(calc(['S1', 'S3'])), 'S2+S3', JSON.stringify(calc(['S2', 'S3'])), 'rows', rowsC.length)
// 先頭を適用
await t.press('Enter'); await page.waitForTimeout(150); if ((await t.panel())?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(250) } /* ラウンド20：集約に確認（U19-04）が付いた。2 集約する */ log('apply →', await t.toast())
p = await t.proj(); const r30 = p.rows.find((r) => r.id === 'R030'), r47b = p.rows.find((r) => r.id === 'R047')
log('R030', r30.adoptedSupplierId, r30.adoptReason, '| R047', r47b.adoptedSupplierId, r47b.status, JSON.stringify(r47b.flags), '| money', moneyBefore, '→', await t.money())
check('M-13 集約は作業中・承認待ちの行を付け替えない', r30.adoptReason !== '集約' && r47b.flags.pmPending === true && r47b.adoptedSupplierId === r47.adoptedSupplierId)
const pend = p.rows.filter((r) => r.adoptReason === '集約' && r.flags.pmPending).map((r) => r.id); log('集約 pending rows', pend.join(','))
await t.role('purchasing')
// M-14: パレットで正式名
for (const q of ['JSON を書き出す', '見積回答を取り込む', '正式見積を依頼', '概算見積を依頼', '商社を集約', '選定記録を出力', '先行発注を申請']) {
  await t.press('Control+k'); await page.getByTestId('palette-input').fill(q); await page.waitForTimeout(100)
  const items = await page.getByTestId('palette-list').locator('.item').allTextContents(); await t.press('Escape')
  log('palette', q, '→', items[0]?.slice(0, 40)); check('M-14 パレット先頭: ' + q, (items[0] ?? '').includes(q.replace(' を', 'を').replace('JSON を', 'JSON を')) || (items[0] ?? '').includes(q), items[0])
}
// M-24: 取込の数値検証・型式不一致
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(80)
const imp = ['行ID\t型式\t単価\t納期\tMOQ\t在庫区分\t有効期限\t代替型式\t代替メーカ\t代替単価\t代替納期', 'R060\tAB150\t1,200円\t2週\t\t取寄\t2026-12-31', 'R061\tMT-2.5 白\t12O0\t5\t\t\t', 'R003\tCP30-XX\t5000\t5', 'R999\tX\t1\t1'].join('\n')
await page.getByTestId('import-text').fill(imp); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(150)
log('import →', await t.toast())
p = await t.proj(); const q60 = p.quotes.find((q) => q.rowId === 'R060' && q.supplierId === 'S1' && !q.stale); const q61 = p.quotes.find((q) => q.rowId === 'R061' && q.supplierId === 'S1' && !q.stale)
log('R060 S1', q60?.unitPrice, q60?.leadDays, '| R061 S1', q61?.unitPrice, '| R003 flags', JSON.stringify(p.rows.find((r) => r.id === 'R003').flags))
check('M-24 取込: 「1,200円」「2週」を読む・読めない値は保存しない・型式不一致は印', q60?.unitPrice === 1200 && q60?.leadDays === 14 && q61?.unitPrice !== null && !Number.isNaN(q61?.unitPrice) && !!p.rows.find((r) => r.id === 'R003').flags.importMismatch)
await t.press('4'); const v4p = await t.viewRows(); check('M-24b 型式不一致の行が購買の 4 に出る', v4p.includes('R003'), v4p.slice(0, 10).join(','))
// Excel 3 種
await t.role('design'); await t.press('1'); await t.goto('R070'); await t.press('h'); await page.waitForTimeout(40) // 隠す
await t.goto('R071'); await t.press('Shift+Delete'); await page.waitForTimeout(40)
async function exportX(n) { const before = t.downloads.length; await t.press('Control+e'); await page.waitForTimeout(80); for (let i = 1; i < n; i++) await t.press('ArrowDown'); await t.press('Enter'); for (let i = 0; i < 40 && t.downloads.length === before; i++) await page.waitForTimeout(100); const d = t.downloads.at(-1); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); return { wb, name: d.suggested } }
await t.role('purchasing'); await t.press('1')
const sup = await exportX(2); const shs = sup.wb.worksheets.map((s) => s.name); const bom = sup.wb.getWorksheet('BOM'); const hdr = bom.getRow(1).values.slice(1); const ids = []; bom.eachRow((r, i) => { if (i > 1) ids.push(r.values[1]) })
log('supplier xlsx sheets', shs, 'cols', hdr.join('|'), 'rows', ids.length, 'has draft R076?', ids.includes('R076'), 'name', sup.name)
check('M-25 商社向けは社内シート（変更点・チェック結果）なし・価格列なし', shs.length === 1 && !hdr.some((h) => /単価|金額|採用|スコア/.test(h)))
check('M3 商社向けに未提出（下書き）の行を出さない', !ids.includes('R076'), ids.filter((x) => ['R076', 'R077', 'R078', 'R079', 'R080'].includes(x)).join(','))
const arc = await exportX(3); const ab = arc.wb.getWorksheet('BOM'); const ah = ab.getRow(1).values; const aids = []; let ballCancelled = null; ab.eachRow((r, i) => { if (i > 1) { aids.push(r.values[1]); if (r.values[1] === 'R071') ballCancelled = r.values[ah.indexOf('ボール')] } })
log('archive rows', aids.length, 'has hidden R070', aids.includes('R070'), 'R071 ball', JSON.stringify(ballCancelled))
check('M-37 保管用は隠した行も出す・取消の行のボールは空欄', aids.includes('R070') && !ballCancelled)
summary(); log('paletteMiss', t.paletteMiss); await t.close()
