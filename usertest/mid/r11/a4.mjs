// a4: 特急・分納の上限超え（購買の 4・PM の 7・PM が決められるか）、PM の 7 で素の y / Shift+Y、設計の 4 で F8、9 の直販の列
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
const raw = (k) => page.keyboard.rawPress(k)
const S = () => page.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return { view: s.view, mode: s.mode, row: s.cursorRow, col: s.cursorCol, edit: s.editValue, toast: s.toast?.text ?? '', panel: s.panel?.kind ?? null, title: s.panel?.title ?? '' } })
await t.open('design')
// 例外選定（3 位を選ぶ）を 2 行つくる
await t.press('1')
const exc = []
for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021', 'R023', 'R024', 'R025']) {
  if (exc.length >= 2) break
  await t.goto(id); await t.press('Shift+A'); await page.waitForTimeout(60); await t.press('3'); await page.waitForTimeout(60); const pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('6'); await page.waitForTimeout(40); const p2 = await t.panel(); if (p2?.kind === 'prompt') { try { await t.promptFill('評価用') } catch {} await t.press('Enter'); await page.waitForTimeout(80) } }
  log('Shift+A 3', id, '→', await t.toast())
  if ((await t.row(id)).flags.pmPending) exc.push(id)
}
log('exception rows', exc)
let p = await t.proj(); log('pmPending', p.rows.filter((r) => r.flags.pmPending).map((r) => r.id + ':' + r.flags.pmReason).join(','))
log('bulk →', await t.bulk())
// ---- PM: 7 を開いて、例外選定の行で素の y / Shift+Y（部品名の列）
await t.role('pm'); await page.waitForTimeout(80)
await t.goto(exc[0]); await t.colKey('name'); let s0 = await S(); await raw('y'); await page.waitForTimeout(100); let s1 = await S(); log('PM raw y on', s0.col, JSON.stringify(s1))
if (s1.panel === 'prompt') { await page.getByTestId('prompt-text').fill('承認'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); if ((await S()).panel) { try { await t.extraFill('承認者', '部長'); await t.extraFill('決裁書No', 'K-1') } catch {} ; await page.getByTestId('prompt-text').press('Enter').catch(() => {}); await page.waitForTimeout(80) } }
p = await t.proj(); const r11 = p.rows.find((r) => r.id === exc[0]); log('R011 after y', r11.status, JSON.stringify(r11.flags), await t.toast())
check('A4-1 (U7-01) PM が 7 の部品名の列で素の y → 例外選定を承認', r11.status === 'selected' && !r11.flags.pmPending, `${r11.status} ${JSON.stringify(r11.flags)}`)
await t.press('7'); await t.goto(exc[1]); await t.colKey('maker'); await raw('Shift+Y'); await page.waitForTimeout(100); s1 = await S(); log('PM raw Shift+Y', JSON.stringify(s1))
if (s1.panel === 'prompt') { await page.getByTestId('prompt-text').fill('却下'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
if ((await S()).panel) { log('panel still open', JSON.stringify(await S())); await raw('Escape'); await raw('Escape') }
p = await t.proj(); const r8 = p.rows.find((r) => r.id === exc[1]); log('R008 after Shift+Y', r8.status, r8.adoptedSupplierId, JSON.stringify(r8.flags))
check('A4-2 (U7-01) PM が 7 のメーカの列で素の Shift+Y → 却下（見積済に戻る）', r8.status === 'quoted' && !r8.flags.pmPending, r8.status)
// 7 で数字・記号
await raw('4'); await page.waitForTimeout(60); log('PM raw 4 →', (await S()).view); await raw('7'); await page.waitForTimeout(60)
// ---- 特急・分納の上限超え
p = await t.proj()
const [L] = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)
log('L', L)
await t.goto(L); await t.press('Enter'); await page.waitForTimeout(80); log('L panel', JSON.stringify(await t.panel())); await t.press('e'); await page.waitForTimeout(80); log('e prompt', JSON.stringify(await t.panel())); await t.promptFill('特急で'); await t.extraFill('上限金額', '30000'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
p = await t.proj(); log('L after e', JSON.stringify(p.rows.find((r) => r.id === L).flags), (await t.toast()))
await t.role('purchasing'); await t.press('3'); await t.showCol('extraCost', 'extraCostKind'); const ec = await t.setCellKey(L, 'extraCost', '45000'); await t.press('Escape'); log('extraCost 45000 →', ec)
await t.press('4'); const pu4 = (await t.viewRows()).includes(L); await t.goto(L); await t.press('Home'); const sbP = await t.status(); log('purch 4 has L', pu4, 'sb', sbP.slice(0, 200))
await t.press('3'); await t.goto(L); const cellAmt = await t.cellText(L, 'extraCost'); log('extra cell', cellAmt)
await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(L); const hdr = await t.header(); log('PM 7 has L', pm7, 'header', hdr.slice(0, 200))
check('A4-3 (U6-01) 上限超えの行が購買の 4 に出る', pu4)
check('A4-4 (U6-01) 上限超えの行が PM の 7 に出る', pm7)
// PM は何ができるか
await t.goto(L); await t.press('Home'); const sbPM = await t.status(); await raw('Enter'); await page.waitForTimeout(80); const pnL = await S(); const pnO = (await t.panel())?.options; log('PM on L: sb', sbPM.slice(0, 200), 'Enter →', JSON.stringify(pnL), JSON.stringify(pnO)); if (pnL.panel) await raw('Escape')
await raw('y'); await page.waitForTimeout(80); const yL = await S(); log('PM y on L', JSON.stringify(yL)); if (yL.panel) await raw('Escape')
await t.goto(L); await t.press(' '); await page.waitForTimeout(80); const detL = await page.getByTestId('detail').textContent(); await t.press(' '); log('PM detail L', detL.slice(detL.indexOf('決定'), detL.indexOf('決定') + 300))
check('A4-5 PM の 7 で、上限超えの行に決める手（上限の引き上げ・超過の承認など）がある', !!pnL.panel || /承認|上限/.test(yL.toast + (yL.title ?? '')), `Enter=${JSON.stringify(pnL)} y=${yL.toast}`)
check('A4-6 7 の行に「上限超え」の理由が見える（ステータスバー・詳細）', /上限/.test(sbPM + detL), sbPM.slice(0, 160))
// 購買が上限内に下げたら 7 から消えるか
await t.role('purchasing'); await t.press('3'); await t.setCellKey(L, 'extraCost', '28000'); await t.press('Escape')
await t.role('pm'); await t.press('7'); log('PM 7 has L after 28000', (await t.viewRows()).includes(L))
// ---- 設計の 4 で F8（既定の位置）
await t.role('design'); await page.waitForTimeout(80); s0 = await S(); const sb4 = await t.status(); log('design start', JSON.stringify(s0), 'sb', sb4.slice(0, 160))
await raw('F8'); await page.waitForTimeout(80); s1 = await S(); log('design F8', JSON.stringify(s1)); await raw('F8'); await page.waitForTimeout(80); const s2 = await S(); log('design F8 #2', JSON.stringify(s2))
check('A4-7 (U6-02) 設計が 4 を開いて F8 → F8 で問題を進む（値にならない）', s1.mode === 'nav' && s2.mode === 'nav' && (s1.row !== s2.row || s1.col !== s2.col), `${s1.row}/${s1.col} → ${s2.row}/${s2.col}`)
check('A4-8 (U6-02) ステータスバーに F8 の案内', /F8/.test(sb4))
// 4 のサイドバーの数字表示
const side = await page.locator('[data-testid^="view-"]').allTextContents(); log('sidebar', side.slice(0, 9).join(' | '))
// ---- 9 の直販の列（U7-04 は保留）
await t.role('purchasing'); await t.press('9'); const v9cols = await page.evaluate(async () => { const m = await import(window.__m('/src/model/selectors.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.viewColumns(s, s.project()).filter((c) => c.includes('@')).join(',') })
log('9 columns', v9cols)
summary(); await t.close()
